export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          title: string
          description: string
          genre: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          genre?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          genre?: string
          created_at?: string
          updated_at?: string
        }
      }
      characters: {
        Row: {
          id: string
          project_id: string
          name: string
          role: string
          description: string
          personality: string
          background: string
          goals: string
          relationships: Json
          notes: string
          ordinary_world: string
          call_to_adventure: string
          refusal_of_call: string
          meeting_the_mentor: string
          crossing_threshold: string
          tests_allies_enemies: string
          approach_innermost_cave: string
          ordeal: string
          reward: string
          road_back: string
          resurrection: string
          return_with_elixir: string
          image_url: string
          image_description: string
          personality_sliders: Json
          dialogue_style: string
          character_arc: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          role?: string
          description?: string
          personality?: string
          background?: string
          goals?: string
          relationships?: Json
          notes?: string
          ordinary_world?: string
          call_to_adventure?: string
          refusal_of_call?: string
          meeting_the_mentor?: string
          crossing_threshold?: string
          tests_allies_enemies?: string
          approach_innermost_cave?: string
          ordeal?: string
          reward?: string
          road_back?: string
          resurrection?: string
          return_with_elixir?: string
          image_url?: string
          image_description?: string
          personality_sliders?: Json
          dialogue_style?: string
          character_arc?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          role?: string
          description?: string
          personality?: string
          background?: string
          goals?: string
          relationships?: Json
          notes?: string
          ordinary_world?: string
          call_to_adventure?: string
          refusal_of_call?: string
          meeting_the_mentor?: string
          crossing_threshold?: string
          tests_allies_enemies?: string
          approach_innermost_cave?: string
          ordeal?: string
          reward?: string
          road_back?: string
          resurrection?: string
          return_with_elixir?: string
          image_url?: string
          image_description?: string
          personality_sliders?: Json
          dialogue_style?: string
          character_arc?: Json
          created_at?: string
          updated_at?: string
        }
      }
      places: {
        Row: {
          id: string
          project_id: string
          name: string
          type: string
          description: string
          history: string
          significance: string
          notes: string
          image_url: string
          image_description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          type?: string
          description?: string
          history?: string
          significance?: string
          notes?: string
          image_url?: string
          image_description?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          type?: string
          description?: string
          history?: string
          significance?: string
          notes?: string
          image_url?: string
          image_description?: string
          created_at?: string
          updated_at?: string
        }
      }
      things: {
        Row: {
          id: string
          project_id: string
          name: string
          type: string
          description: string
          properties: string
          history: string
          notes: string
          image_url: string
          image_description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          type?: string
          description?: string
          properties?: string
          history?: string
          notes?: string
          image_url?: string
          image_description?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          type?: string
          description?: string
          properties?: string
          history?: string
          notes?: string
          image_url?: string
          image_description?: string
          created_at?: string
          updated_at?: string
        }
      }
      technologies: {
        Row: {
          id: string
          project_id: string
          name: string
          type: string
          description: string
          rules: string
          applications: string
          notes: string
          image_url: string
          image_description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          type?: string
          description?: string
          rules?: string
          applications?: string
          notes?: string
          image_url?: string
          image_description?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          type?: string
          description?: string
          rules?: string
          applications?: string
          notes?: string
          image_url?: string
          image_description?: string
          created_at?: string
          updated_at?: string
        }
      }
      outlines: {
        Row: {
          id: string
          project_id: string
          title: string
          synopsis: string
          act_structure: string
          themes: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          synopsis?: string
          act_structure?: string
          themes?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          synopsis?: string
          act_structure?: string
          themes?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      chapters: {
        Row: {
          id: string
          outline_id: string
          project_id: string
          order_index: number
          title: string
          summary: string
          pov_character_id: string | null
          setting_place_id: string | null
          key_events: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          outline_id: string
          project_id: string
          order_index?: number
          title: string
          summary?: string
          pov_character_id?: string | null
          setting_place_id?: string | null
          key_events?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          outline_id?: string
          project_id?: string
          order_index?: number
          title?: string
          summary?: string
          pov_character_id?: string | null
          setting_place_id?: string | null
          key_events?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      scenes: {
        Row: {
          id: string
          chapter_id: string
          project_id: string
          order_index: number
          title: string
          description: string
          content: string
          status: string
          ai_prompt: string
          context_data: Json
          notes: string
          generated_image_url: string
          image_prompt: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          project_id: string
          order_index?: number
          title: string
          description?: string
          content?: string
          status?: string
          ai_prompt?: string
          context_data?: Json
          notes?: string
          generated_image_url?: string
          image_prompt?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chapter_id?: string
          project_id?: string
          order_index?: number
          title?: string
          description?: string
          content?: string
          status?: string
          ai_prompt?: string
          context_data?: Json
          notes?: string
          generated_image_url?: string
          image_prompt?: string
          created_at?: string
          updated_at?: string
        }
      }
      generation_settings: {
        Row: {
          id: string
          project_id: string
          model_name: string
          api_endpoint: string
          temperature: number
          max_tokens: number
          system_prompt: string
          style_guide: string
          top_p: number
          top_k: number
          repetition_penalty: number
          presence_penalty: number
          frequency_penalty: number
          context_length: number
          stop_sequences: string[]
          style_rules: Json
          vision_api_endpoint: string
          vision_api_key: string
          vision_model_name: string
          use_ollama_vision: boolean
          ollama_endpoint: string
          ollama_vision_model: string
          comfyui_endpoint: string
          comfyui_workflow: Json
          comfyui_checkpoint: string
          image_width: number
          image_height: number
          image_steps: number
          image_cfg_scale: number
          image_sampler: string
          image_negative_prompt: string
          comfyui_tts_workflow: Json
          comfyui_tts_speaker: string
          comfyui_tts_sample_rate: number
          voice_chat_enabled: boolean
          voice_chat_voice: string
          voice_chat_rate: number
          voice_chat_pitch: number
          art_style_presets: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          model_name?: string
          api_endpoint?: string
          temperature?: number
          max_tokens?: number
          system_prompt?: string
          style_guide?: string
          top_p?: number
          top_k?: number
          repetition_penalty?: number
          presence_penalty?: number
          frequency_penalty?: number
          context_length?: number
          stop_sequences?: string[]
          style_rules?: Json
          vision_api_endpoint?: string
          vision_api_key?: string
          vision_model_name?: string
          use_ollama_vision?: boolean
          ollama_endpoint?: string
          ollama_vision_model?: string
          comfyui_endpoint?: string
          comfyui_workflow?: Json
          comfyui_checkpoint?: string
          image_width?: number
          image_height?: number
          image_steps?: number
          image_cfg_scale?: number
          image_sampler?: string
          image_negative_prompt?: string
          comfyui_tts_workflow?: Json
          comfyui_tts_speaker?: string
          comfyui_tts_sample_rate?: number
          voice_chat_enabled?: boolean
          voice_chat_voice?: string
          voice_chat_rate?: number
          voice_chat_pitch?: number
          art_style_presets?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          model_name?: string
          api_endpoint?: string
          temperature?: number
          max_tokens?: number
          system_prompt?: string
          style_guide?: string
          top_p?: number
          top_k?: number
          repetition_penalty?: number
          presence_penalty?: number
          frequency_penalty?: number
          context_length?: number
          stop_sequences?: string[]
          style_rules?: Json
          vision_api_endpoint?: string
          vision_api_key?: string
          vision_model_name?: string
          use_ollama_vision?: boolean
          ollama_endpoint?: string
          ollama_vision_model?: string
          comfyui_endpoint?: string
          comfyui_workflow?: Json
          comfyui_checkpoint?: string
          image_width?: number
          image_height?: number
          image_steps?: number
          image_cfg_scale?: number
          image_sampler?: string
          image_negative_prompt?: string
          comfyui_tts_workflow?: Json
          comfyui_tts_speaker?: string
          comfyui_tts_sample_rate?: number
          voice_chat_enabled?: boolean
          voice_chat_voice?: string
          voice_chat_rate?: number
          voice_chat_pitch?: number
          art_style_presets?: Json
          created_at?: string
          updated_at?: string
        }
      }
      story_events: {
        Row: {
          id: string
          project_id: string
          scene_id: string | null
          chapter_id: string | null
          title: string
          description: string
          importance: string
          affects_characters: string[]
          affects_world: boolean
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          scene_id?: string | null
          chapter_id?: string | null
          title: string
          description?: string
          importance?: string
          affects_characters?: string[]
          affects_world?: boolean
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          scene_id?: string | null
          chapter_id?: string | null
          title?: string
          description?: string
          importance?: string
          affects_characters?: string[]
          affects_world?: boolean
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      character_states: {
        Row: {
          id: string
          character_id: string
          scene_id: string
          project_id: string
          physical_state: string
          emotional_state: string
          knowledge: string
          possessions: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          character_id: string
          scene_id: string
          project_id: string
          physical_state?: string
          emotional_state?: string
          knowledge?: string
          possessions?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          scene_id?: string
          project_id?: string
          physical_state?: string
          emotional_state?: string
          knowledge?: string
          possessions?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      scene_references: {
        Row: {
          id: string
          scene_id: string
          project_id: string
          reference_type: string
          reference_note: string
          tags: string[]
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          project_id: string
          reference_type?: string
          reference_note?: string
          tags?: string[]
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          project_id?: string
          reference_type?: string
          reference_note?: string
          tags?: string[]
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      scene_summaries: {
        Row: {
          id: string
          scene_id: string
          project_id: string
          summary: string
          key_facts: string[]
          characters_involved: string[]
          emotional_arc: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          project_id: string
          summary?: string
          key_facts?: string[]
          characters_involved?: string[]
          emotional_arc?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          project_id?: string
          summary?: string
          key_facts?: string[]
          characters_involved?: string[]
          emotional_arc?: string
          created_at?: string
          updated_at?: string
        }
      }
      story_bible_entries: {
        Row: {
          id: string
          project_id: string
          category: string
          subject: string
          fact: string
          source_scene_id: string | null
          importance: string
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          category?: string
          subject?: string
          fact?: string
          source_scene_id?: string | null
          importance?: string
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          category?: string
          subject?: string
          fact?: string
          source_scene_id?: string | null
          importance?: string
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      style_anchors: {
        Row: {
          id: string
          project_id: string
          label: string
          passage: string
          notes: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          label?: string
          passage?: string
          notes?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          label?: string
          passage?: string
          notes?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      scene_context_tags: {
        Row: {
          id: string
          scene_id: string
          project_id: string
          entity_type: string
          entity_id: string
          entity_name: string
          created_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          project_id: string
          entity_type?: string
          entity_id: string
          entity_name?: string
          created_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          project_id?: string
          entity_type?: string
          entity_id?: string
          entity_name?: string
          created_at?: string
        }
      }
      story_dossiers: {
        Row: {
          id: string
          project_id: string
          content: string
          genre_tropes: string
          braindump: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          content?: string
          genre_tropes?: string
          braindump?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          content?: string
          genre_tropes?: string
          braindump?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      scene_briefs: {
        Row: {
          id: string
          chapter_id: string
          project_id: string
          pov_character: string
          genre: string
          plot_beats: string
          scene_function: string
          characters_in_scene: string
          setting_details: string
          conflict: string
          tone_notes: string
          symbolism: string
          continuity_notes: string
          other_notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          project_id: string
          pov_character?: string
          genre?: string
          plot_beats?: string
          scene_function?: string
          characters_in_scene?: string
          setting_details?: string
          conflict?: string
          tone_notes?: string
          symbolism?: string
          continuity_notes?: string
          other_notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chapter_id?: string
          project_id?: string
          pov_character?: string
          genre?: string
          plot_beats?: string
          scene_function?: string
          characters_in_scene?: string
          setting_details?: string
          conflict?: string
          tone_notes?: string
          symbolism?: string
          continuity_notes?: string
          other_notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      prohibited_words: {
        Row: {
          id: string
          project_id: string
          word: string
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          word: string
          category?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          word?: string
          category?: string
          created_at?: string
        }
      }
      editing_passes: {
        Row: {
          id: string
          scene_id: string
          project_id: string
          pass_type: string
          content: string
          original_content: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          project_id: string
          pass_type?: string
          content?: string
          original_content?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          project_id?: string
          pass_type?: string
          content?: string
          original_content?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      tts_chunks: {
        Row: {
          id: string
          project_id: string
          chapter_id: string
          scene_id: string | null
          chunk_index: number
          text_content: string
          audio_url: string
          status: string
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          chapter_id: string
          scene_id?: string | null
          chunk_index?: number
          text_content: string
          audio_url?: string
          status?: string
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          chapter_id?: string
          scene_id?: string | null
          chunk_index?: number
          text_content?: string
          audio_url?: string
          status?: string
          duration_seconds?: number | null
          created_at?: string
        }
      }
      logic_checks: {
        Row: {
          id: string
          project_id: string
          check_type: string
          target_id: string | null
          target_name: string
          result: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          check_type?: string
          target_id?: string | null
          target_name?: string
          result?: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          check_type?: string
          target_id?: string | null
          target_name?: string
          result?: string
          status?: string
          created_at?: string
        }
      }
    }
  }
}
