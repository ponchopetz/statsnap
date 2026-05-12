import { createContext, useContext, useState, useRef, Children } from "react";
import "./Tabs.css";

// Context shares the active tab and its setter between the root Tabs component
// and its subcomponents (List, Tab, Panel) without prop drilling.
const TabsContext = createContext(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error("Tabs.List, Tabs.Tab, and Tabs.Panel must be used inside <Tabs>.");
  }
  return ctx;
}

/**
 * Tabs — compound component with hybrid controlled/uncontrolled state.
 *
 * Uncontrolled (default): pass `defaultTab="..."`. Tabs manages its own state.
 * Controlled: pass `activeTab` and `onTabChange`. Parent owns the state.
 *
 * Detection mirrors React's <input>: controlled iff `activeTab` is defined.
 */
function Tabs({ defaultTab, activeTab: controlledActiveTab, onTabChange, children }) {
  const [internalActive, setInternalActive] = useState(defaultTab);

  const isControlled = controlledActiveTab !== undefined;
  const activeTab = isControlled ? controlledActiveTab : internalActive;

  const setActiveTab = (id) => {
    if (!isControlled) {
      setInternalActive(id);
    }
    // Fire onTabChange in both modes — useful for analytics even when uncontrolled.
    onTabChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

/**
 * Tabs.List — wraps the tab buttons. Handles arrow key navigation across them.
 */
function TabsList({ children }) {
  const { activeTab, setActiveTab } = useTabsContext();
  const listRef = useRef(null);

  // Extract tab IDs from direct children in render order.
  // Roving tabindex and arrow nav both depend on knowing the ordered set.
  const tabIds = Children.toArray(children)
    .filter((child) => child?.props?.id)
    .map((child) => child.props.id);

  const onKeyDown = (e) => {
    const currentIndex = tabIds.indexOf(activeTab);
    if (currentIndex === -1) return;

    let nextIndex = null;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabIds.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = tabIds.length - 1;

    if (nextIndex !== null) {
      e.preventDefault();
      const nextId = tabIds[nextIndex];
      setActiveTab(nextId);
      // Move focus to the newly-active tab. tabIndex=-1 elements ARE focusable
      // programmatically; only the keyboard Tab key skips them.
      const nextEl = listRef.current?.querySelector(`[data-tab-id="${nextId}"]`);
      nextEl?.focus();
    }
  };

  return (
    <div className="tabs-list" role="tablist" ref={listRef} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

/**
 * Tabs.Tab — a single clickable tab button.
 * Uses roving tabindex: only the active tab is in the tab sequence (tabIndex=0);
 * the rest are reachable only via arrow keys within the tablist.
 */
function TabsTab({ id, children }) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      data-tab-id={id}
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      tabIndex={isActive ? 0 : -1}
      className={`tabs-tab${isActive ? " tabs-tab-active" : ""}`}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

/**
 * Tabs.Panel — the body of one tab. Renders only when active.
 * Mount-on-activate (rather than always-render-hidden) keeps the DOM lean;
 * the tradeoff is that any internal state inside a panel resets on tab switch.
 */
function TabsPanel({ id, children }) {
  const { activeTab } = useTabsContext();
  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className="tabs-panel"
    >
      {children}
    </div>
  );
}

// Attach subcomponents to the root so consumers use the dot syntax: <Tabs.List>, etc.
Tabs.List = TabsList;
Tabs.Tab = TabsTab;
Tabs.Panel = TabsPanel;

export default Tabs;
