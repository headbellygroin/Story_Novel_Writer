import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Projects from './pages/Projects';
import WorldLibrary from './pages/WorldLibrary';
import Outline from './pages/Outline';
import Write from './pages/Write';
import Consistency from './pages/Consistency';
import Export from './pages/Export';
import Settings from './pages/Settings';
import StoryBible from './pages/StoryBible';
import StyleAnchors from './pages/StyleAnchors';
import Dossier from './pages/Dossier';
import ProhibitedWords from './pages/ProhibitedWords';
import LogicChecks from './pages/LogicChecks';
import SaveLoad from './pages/SaveLoad';
import VoiceChat from './pages/VoiceChat';
import Audiobook from './pages/Audiobook';
import Pipeline from './pages/Pipeline';
import SetupGuide from './pages/SetupGuide';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/projects"
          element={
            <Layout>
              <Projects />
            </Layout>
          }
        />
        <Route
          path="/world"
          element={
            <Layout>
              <WorldLibrary />
            </Layout>
          }
        />
        <Route
          path="/outline"
          element={
            <Layout>
              <Outline />
            </Layout>
          }
        />
        <Route
          path="/write"
          element={
            <Layout>
              <Write />
            </Layout>
          }
        />
        <Route
          path="/story-bible"
          element={
            <Layout>
              <StoryBible />
            </Layout>
          }
        />
        <Route
          path="/style-anchors"
          element={
            <Layout>
              <StyleAnchors />
            </Layout>
          }
        />
        <Route
          path="/consistency"
          element={
            <Layout>
              <Consistency />
            </Layout>
          }
        />
        <Route
          path="/export"
          element={
            <Layout>
              <Export />
            </Layout>
          }
        />
        <Route
          path="/settings"
          element={
            <Layout>
              <Settings />
            </Layout>
          }
        />
        <Route
          path="/dossier"
          element={
            <Layout>
              <Dossier />
            </Layout>
          }
        />
        <Route
          path="/prohibited-words"
          element={
            <Layout>
              <ProhibitedWords />
            </Layout>
          }
        />
        <Route
          path="/logic-checks"
          element={
            <Layout>
              <LogicChecks />
            </Layout>
          }
        />
        <Route
          path="/save-load"
          element={
            <Layout>
              <SaveLoad />
            </Layout>
          }
        />
        <Route
          path="/voice-chat"
          element={
            <Layout>
              <VoiceChat />
            </Layout>
          }
        />
        <Route
          path="/audiobook"
          element={
            <Layout>
              <Audiobook />
            </Layout>
          }
        />
        <Route
          path="/pipeline"
          element={
            <Layout>
              <Pipeline />
            </Layout>
          }
        />
        <Route
          path="/setup-guide"
          element={
            <Layout>
              <SetupGuide />
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
