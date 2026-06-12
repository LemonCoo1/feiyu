function App() {
  return (
    <div className="flex h-screen w-screen">
      <div className="w-[60px] bg-feiyu-sidebar flex items-center justify-center">
        <span className="text-white text-2xl font-bold">F</span>
      </div>
      <div className="w-[280px] bg-white border-r border-feiyu-border flex items-center justify-center">
        <span className="text-feiyu-text-muted">会话列表</span>
      </div>
      <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
        <span className="text-feiyu-text-muted">聊天窗口</span>
      </div>
    </div>
  );
}

export default App;
