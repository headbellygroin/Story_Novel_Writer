import { supabase } from '../lib/supabase';
import { generateScene } from './aiService';

export interface GenerationJob {
  id: string;
  project_id: string;
  task_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  current_step: number;
  total_steps: number;
  step_label: string;
  prompt: string;
  result: string;
  error_message: string;
  settings_snapshot: any;
  metadata: any;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type GenerationMode = 'guided' | 'accelerated';

export interface WizardJobMetadata {
  book_count: number;
  genre: string;
  end_goal: string;
  planning_style: string;
  world_summary: string;
  canon_rule: string;
  planning_guidance: string;
  generation_mode: GenerationMode;
  auto_approve_steps: string[];
  needs_review: boolean;
  outputs: {
    seriesMap: string;
    majorEvents: string;
    bookOutline: string;
    chapterList: string;
    chapterBriefs: string;
    scenes: string;
  };
}

const STEP_KEYS = ['seriesMap', 'majorEvents', 'bookOutline', 'chapterList', 'chapterBriefs', 'scenes'] as const;

const MIN_OUTPUT_LENGTH = 100;

const REFUSAL_PATTERNS = [
  /^i('m| am) (sorry|unable|not able)/i,
  /^i cannot/i,
  /^as an ai/i,
  /^i apologize/i,
  /^unfortunately,? i (can't|cannot|am unable)/i,
  /^i don't have (the ability|access|enough)/i,
];

const CONTEXT_OVERFLOW_PATTERNS = [
  /context (length|window|limit) exceeded/i,
  /maximum context/i,
  /token limit/i,
  /input too long/i,
  /reduce the length/i,
];

function detectRefusal(text: string): boolean {
  const trimmed = text.trim();
  return REFUSAL_PATTERNS.some(p => p.test(trimmed));
}

function detectContextOverflow(text: string): boolean {
  return CONTEXT_OVERFLOW_PATTERNS.some(p => p.test(text));
}

type JobListener = (job: GenerationJob) => void;

class GenerationJobRunner {
  private activeJobId: string | null = null;
  private aborted = false;
  private listeners: Map<string, Set<JobListener>> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  subscribe(jobId: string, listener: JobListener): () => void {
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId)!.add(listener);

    if (jobId !== this.activeJobId) {
      this.startPolling(jobId);
    }

    return () => {
      const set = this.listeners.get(jobId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(jobId);
          this.stopPolling();
        }
      }
    };
  }

  private notify(job: GenerationJob) {
    const set = this.listeners.get(job.id);
    if (set) {
      set.forEach(fn => fn(job));
    }
  }

  private startPolling(jobId: string) {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      const job = await this.getJob(jobId);
      if (job) {
        this.notify(job);
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          this.stopPolling();
        }
      }
    }, 2000);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async getJob(jobId: string): Promise<GenerationJob | null> {
    const { data } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    return data as GenerationJob | null;
  }

  async getActiveJob(projectId: string): Promise<GenerationJob | null> {
    const { data } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as GenerationJob | null;
  }

  async getRecentJobs(projectId: string, limit = 10): Promise<GenerationJob[]> {
    const { data } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as GenerationJob[];
  }

  isRunning(): boolean {
    return this.activeJobId !== null && !this.aborted;
  }

  getActiveJobId(): string | null {
    return this.activeJobId;
  }

  async cancelJob(jobId: string): Promise<void> {
    if (this.activeJobId === jobId) {
      this.aborted = true;
      this.activeJobId = null;
    }
    await supabase
      .from('generation_jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', jobId);
    const job = await this.getJob(jobId);
    if (job) this.notify(job);
  }

  async createWizardJob(
    projectId: string,
    settings: any,
    metadata: WizardJobMetadata,
  ): Promise<string> {
    const { data, error } = await supabase
      .from('generation_jobs')
      .insert({
        project_id: projectId,
        task_type: 'wizard_quick',
        status: 'queued',
        current_step: 0,
        total_steps: 6,
        step_label: 'Queued',
        settings_snapshot: settings,
        metadata,
      })
      .select('id')
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to create job');
    return data.id;
  }

  async runWizardJob(jobId: string): Promise<void> {
    this.activeJobId = jobId;
    this.aborted = false;

    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');

    const meta = job.metadata as WizardJobMetadata;
    const settings = job.settings_snapshot;
    const outputs = { ...meta.outputs };
    const isAccelerated = meta.generation_mode === 'accelerated';
    const autoApproveSteps = meta.auto_approve_steps || [];

    const { world_summary: world, canon_rule: canonRule, planning_guidance: planningGuidance } = meta;
    const genreText = meta.genre || 'epic genre fiction';
    const endText = meta.end_goal || 'the protagonist achieves their ultimate goal';

    const steps: Array<{
      key: typeof STEP_KEYS[number];
      label: string;
      buildPrompt: () => string;
    }> = [
      {
        key: 'seriesMap',
        label: 'Series Map',
        buildPrompt: () => `${world}${canonRule}${planningGuidance}
=== TASK: SERIES MAP ===
Create a ${meta.book_count}-book series roadmap.
Genre/Tone: ${genreText}
Series End Goal: ${endText}

For each book provide ONLY:
- Book title
- Theme (one sentence)
- Beginning State (one sentence)
- Ending State (one sentence)
- Major Events (3-5 bullet points, one line each)
- Character Growth (one sentence)
- World Changes (one sentence)

CRITICAL RULES:
- You MUST include ALL ${meta.book_count} books.
- Keep each book summary to 8-12 lines maximum.
- Do NOT create chapter outlines or chapter lists.
- Do NOT create scene outlines.
- Do NOT expand beyond the bullet format above.
- Focus only on the overall series arc across all ${meta.book_count} books.`,
      },
      {
        key: 'majorEvents',
        label: 'Major Events',
        buildPrompt: () => `${world}${canonRule}${planningGuidance}
=== SERIES MAP (APPROVED) ===
${outputs.seriesMap}

=== TASK: MAJOR EVENTS FOR BOOK 1 ===
Generate the major turning points for Book 1.
Genre/Tone: ${genreText}

Include:
- Opening
- Inciting Incident
- First Turning Point
- Midpoint
- Major Reversal
- Climax
- Resolution

For each event provide: what happens, characters involved, consequence, and emotional weight.
Do not generate chapters.`,
      },
      {
        key: 'bookOutline',
        label: 'Book Outline',
        buildPrompt: () => `${world}${canonRule}${planningGuidance}
=== SERIES MAP ===
${outputs.seriesMap}

=== BOOK 1 MAJOR EVENTS ===
${outputs.majorEvents}

=== TASK: BOOK 1 OUTLINE ===
Convert Book 1 major events into a detailed book outline.
Genre/Tone: ${genreText}

Include:
- Act 1 setup (world state, character introductions, inciting incident)
- Act 2 rising action (complications, subplots, midpoint)
- Act 2B descent (consequences, dark moment)
- Act 3 resolution (climax, resolution, new equilibrium)
- Series threads advanced
- Character arcs progressed

Do not generate chapter lists yet.`,
      },
      {
        key: 'chapterList',
        label: 'Chapter List',
        buildPrompt: () => `${world}${canonRule}${planningGuidance}
=== BOOK 1 OUTLINE ===
${outputs.bookOutline}

=== BOOK 1 MAJOR EVENTS ===
${outputs.majorEvents}

=== TASK: CHAPTER LIST FOR BOOK 1 ===
Generate ALL chapters for Book 1 (typically 10-15 chapters based on the outline above).
Genre/Tone: ${genreText}

For each chapter provide:
- Chapter number
- Working title
- POV character
- Primary location
- Key events (2-3 bullet points)
- Emotional tone

One paragraph per chapter. No scene breakdowns.`,
      },
      {
        key: 'chapterBriefs',
        label: 'Chapter Briefs',
        buildPrompt: () => `${world}${canonRule}${planningGuidance}
=== CHAPTER LIST ===
${outputs.chapterList}

=== BOOK OUTLINE ===
${outputs.bookOutline}

=== TASK: CHAPTER BRIEFS (BOOK 1, ALL CHAPTERS) ===
Genre/Tone: ${genreText}

Generate detailed chapter briefs for ALL chapters listed above. For each chapter:
- Opening state
- Scene-by-scene breakdown (3-5 scenes per chapter, numbered list with one-sentence descriptions)
- Character goals and obstacles
- Key dialogue beats or reveals
- Closing state / cliffhanger
- Theme advancement

These briefs should be detailed enough that a writer could produce the chapter from them.
You MUST cover every chapter in the chapter list. Do not stop early.`,
      },
      {
        key: 'scenes',
        label: 'Scene Breakdown',
        buildPrompt: () => `${world}${canonRule}${planningGuidance}
=== CHAPTER BRIEF (CHAPTER 1) ===
${outputs.chapterBriefs}

=== TASK: SCENE BREAKDOWN (CHAPTER 1) ===
Genre/Tone: ${genreText}

Generate individual scene cards for Chapter 1. For each scene provide:
- Scene title
- POV character
- Location
- Characters present
- Opening beat
- Core conflict/tension
- Key dialogue moments
- Closing beat / transition
- Estimated word count`,
      },
    ];

    try {
      await this.updateJob(jobId, {
        status: 'running',
        started_at: new Date().toISOString(),
      });

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (this.aborted) return;

        // Skip if already done
        if (outputs[step.key]) {
          continue;
        }

        // In accelerated mode, check if this step is auto-approved
        // In guided mode, all steps run when the job is created (approval handled at component level)
        if (isAccelerated && !autoApproveSteps.includes(step.key)) {
          continue;
        }

        const stepNum = i + 1;
        await this.updateJob(jobId, {
          current_step: stepNum,
          step_label: `Generating ${step.label}...`,
          metadata: { ...meta, outputs },
        });

        const prompt = step.buildPrompt();
        let result: string;

        try {
          result = await generateScene({
            sceneDescription: prompt,
            generationMode: 'outline',
            contextMode: 'minimal',
            worldRichness: 'minimal',
            planningMode: 'creative',
            context: {},
            settings,
          });
        } catch (fetchErr: any) {
          const errMsg = fetchErr.message || 'Generation request failed';
          if (detectContextOverflow(errMsg)) {
            await this.updateJob(jobId, {
              status: 'failed',
              error_message: `Context window exceeded at step "${step.label}". The accumulated context is too large for the model. Try a model with a larger context window or reduce world data.`,
              metadata: { ...meta, outputs },
            });
          } else {
            await this.updateJob(jobId, {
              status: 'failed',
              error_message: `Step "${step.label}" failed: ${errMsg}`,
              metadata: { ...meta, outputs },
            });
          }
          return;
        }

        if (this.aborted) return;

        // Safeguard: check output quality
        if (!result || result.trim().length < MIN_OUTPUT_LENGTH) {
          await this.updateJob(jobId, {
            status: 'failed',
            error_message: `Step "${step.label}" produced empty or insufficient output (${result?.trim().length || 0} chars). The model may have encountered an issue. All prior steps are preserved.`,
            metadata: { ...meta, outputs },
          });
          return;
        }

        if (detectRefusal(result)) {
          await this.updateJob(jobId, {
            status: 'failed',
            error_message: `Step "${step.label}" returned a refusal/error response from the model. The output begins with: "${result.slice(0, 120)}..." All prior steps are preserved.`,
            metadata: { ...meta, outputs },
          });
          return;
        }

        if (detectContextOverflow(result)) {
          await this.updateJob(jobId, {
            status: 'failed',
            error_message: `Step "${step.label}" indicates context window overflow. Try a model with a larger context window. All prior steps are preserved.`,
            metadata: { ...meta, outputs },
          });
          return;
        }

        outputs[step.key] = result;

        // Persist after every step
        await this.updateJob(jobId, {
          current_step: stepNum,
          step_label: `${step.label} complete`,
          metadata: { ...meta, outputs },
        });
      }

      // All done -- mark needs_review for accelerated jobs
      const updatedMeta = { ...meta, outputs, needs_review: isAccelerated };
      await this.updateJob(jobId, {
        status: 'completed',
        current_step: 6,
        step_label: isAccelerated ? 'All steps complete - Needs Review' : 'All steps complete',
        result: JSON.stringify(outputs),
        metadata: updatedMeta,
        completed_at: new Date().toISOString(),
      });
    } catch (err: any) {
      if (!this.aborted) {
        await this.updateJob(jobId, {
          status: 'failed',
          error_message: err.message || 'Generation failed',
          metadata: { ...meta, outputs },
        });
      }
    } finally {
      this.activeJobId = null;
    }
  }

  private async updateJob(jobId: string, updates: Partial<GenerationJob>) {
    await supabase
      .from('generation_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    const job = await this.getJob(jobId);
    if (job) this.notify(job);
  }
}

export const jobRunner = new GenerationJobRunner();
