export function SearchBar() {
  return (
    <div className="px-3 py-2">
      <input
        type="text"
        placeholder="搜索联系人、消息..."
        className="w-full bg-white border border-feiyu-border rounded-md px-3 py-2 text-sm text-feiyu-text placeholder:text-feiyu-text-muted focus:outline-none focus:border-feiyu-primary"
      />
    </div>
  );
}
