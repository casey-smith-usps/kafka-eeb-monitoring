import { useState } from 'react';
import Layout from './components/Layout';
import DashboardOverview from './components/DashboardOverview';
import TopicsOverview from './components/TopicsOverview';
import TopicDetail from './components/TopicDetail';
import TopicModal from './components/TopicModal';
import ExcelImport from './components/ExcelImport';
import KafkaSync from './components/KafkaSync';
import MorningStandup from './components/MorningStandup';
import AlertsDashboard from './components/AlertsDashboard';
import TopicLineage from './components/TopicLineage';
import OnCallEscalation from './components/OnCallEscalation';
import Documents from './components/Documents';
import Architecture from './components/Architecture';
import { AIAssistant } from './components/AIAssistant';
import { DataStreaming } from './components/DataStreaming';
import { Topic } from './lib/supabase';

function App() {
  const [currentView, setCurrentView] = useState('overview');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showKafkaSync, setShowKafkaSync] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  const handleAddTopic = () => {
    setEditingTopic(null);
    setShowTopicModal(true);
  };

  const handleImportExcel = () => {
    setShowExcelImport(true);
  };

  const handleKafkaSync = () => {
    setShowKafkaSync(true);
  };

  const handleEditTopic = (topic: Topic) => {
    setEditingTopic(topic);
    setShowTopicModal(true);
  };

  const handleSelectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    setCurrentView('topic-detail');
  };

  const handleBackFromDetail = () => {
    setSelectedTopic(null);
    setCurrentView('topics');
  };

  const handleModalClose = () => {
    setShowTopicModal(false);
    setEditingTopic(null);
  };

  const handleModalSave = () => {
    if (currentView === 'topics' || currentView === 'topic-detail') {
      window.location.reload();
    }
  };

  const renderContent = () => {
    if (currentView === 'topic-detail' && selectedTopic) {
      return (
        <TopicDetail
          topicId={selectedTopic.id}
          onBack={handleBackFromDetail}
          onEdit={handleEditTopic}
        />
      );
    }

    switch (currentView) {
      case 'overview':
        return <DashboardOverview onNavigate={setCurrentView} />;
      case 'topics':
        return (
          <TopicsOverview
            onAddTopic={handleAddTopic}
            onImportExcel={handleImportExcel}
            onKafkaSync={handleKafkaSync}
            onSelectTopic={handleSelectTopic}
          />
        );
      case 'standup':
        return <MorningStandup />;
      case 'alerts':
        return <AlertsDashboard />;
      case 'lineage':
        return <TopicLineage />;
      case 'streaming':
        return <DataStreaming />;
      case 'oncall':
        return <OnCallEscalation />;
      case 'documents':
        return <Documents />;
      case 'architecture':
        return <Architecture />;
      case 'ai-assistant':
        return <AIAssistant />;
      default:
        return <DashboardOverview onNavigate={setCurrentView} />;
    }
  };

  return (
    <>
      <Layout currentView={currentView} onViewChange={setCurrentView}>
        {renderContent()}
      </Layout>
      <TopicModal
        isOpen={showTopicModal}
        onClose={handleModalClose}
        onSave={handleModalSave}
        topic={editingTopic}
      />
      <ExcelImport
        isOpen={showExcelImport}
        onClose={() => setShowExcelImport(false)}
        onImportComplete={() => {
          setShowExcelImport(false);
          window.location.reload();
        }}
      />
      <KafkaSync
        isOpen={showKafkaSync}
        onClose={() => setShowKafkaSync(false)}
        onSyncComplete={() => {
          setShowKafkaSync(false);
          window.location.reload();
        }}
      />
    </>
  );
}

export default App;
