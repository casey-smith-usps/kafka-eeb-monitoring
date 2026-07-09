import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import RequestAccess from './components/RequestAccess';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
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
import { UserManagement } from './components/UserManagement';
import { DataFreshness } from './components/DataFreshness';
import SchemaValidator from './components/SchemaValidator';
import AvroSchemaBuilder from './components/AvroSchemaBuilder';
import ICDAssistant from './components/ICDAssistant';
import { Topic } from './lib/supabase';

function DashboardApp() {
  const { userProfile } = useAuth();
  const [currentView, setCurrentView] = useState('overview');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showKafkaSync, setShowKafkaSync] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  if (!userProfile) {
    return null;
  }

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
      case 'data-freshness':
        return <DataFreshness />;
      case 'streaming':
        return (
          <ProtectedRoute requireAdmin={true}>
            <DataStreaming />
          </ProtectedRoute>
        );
      case 'oncall':
        return <OnCallEscalation />;
      case 'documents':
        return <Documents />;
      case 'architecture':
        return <Architecture />;
      case 'ai-assistant':
        return <AIAssistant />;
      case 'schema-validator':
        return <SchemaValidator />;
      case 'icd-builder':
        return <AvroSchemaBuilder />;
      case 'icd-assistant':
        return <ICDAssistant />;
      case 'users':
        return (
          <ProtectedRoute requireAdmin={true}>
            <UserManagement />
          </ProtectedRoute>
        );
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

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { userProfile, isLoading, signInWithToken, isActive } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    console.log('AppContent state:', {
      userProfile: userProfile ? { email: userProfile.email, role: userProfile.role, status: userProfile.status } : null,
      isLoading,
      isActive
    });
  }, [userProfile, isLoading, isActive]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const view = urlParams.get('view');

    if (view === 'login') {
      setShowLogin(true);
    }

    if (token && !userProfile) {
      signInWithToken(token).then((result) => {
        if (result.success) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    }
  }, [userProfile, signInWithToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  console.log('AppContent rendering - userProfile:', userProfile);

  if (!userProfile) {
    console.log('No userProfile, showing', showLogin ? 'Login' : 'RequestAccess');
    return showLogin
      ? <Login onShowRequestAccess={() => setShowLogin(false)} />
      : <RequestAccess onShowLogin={() => setShowLogin(true)} />;
  }

  console.log('UserProfile exists, rendering ProtectedRoute');
  return (
    <ProtectedRoute>
      <DashboardApp />
    </ProtectedRoute>
  );
}

export default App;
