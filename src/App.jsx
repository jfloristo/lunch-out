import { useState, useMemo, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';

const STORAGE_KEY = 'lunch-out-data';

const DEFAULT_PEOPLE = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

const DEFAULT_ITEMS = [
  { id: 'i1', name: 'Burger', price: 15.00, quantity: 1, assignedTo: ['p1'] },
  { id: 'i2', name: 'Fries', price: 5.00, quantity: 1, assignedTo: ['p1', 'p2'] },
];

const VAT_RATE = 0.12;

const DEFAULT_SERVICE_CHARGE = {
  value: 10,
  type: 'percent', // 'percent' or 'fixed'
  distribution: 'proportional', // 'proportional' or 'equal'
  deductVat: false, // when true, % SC is computed on subtotal ÷ 1.12
};

function loadStoredData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      title: typeof data.title === 'string' ? data.title : null,
      people: Array.isArray(data.people) ? data.people : null,
      items: Array.isArray(data.items) ? data.items : null,
      serviceCharge: data.serviceCharge && typeof data.serviceCharge === 'object' ? data.serviceCharge : null,
    };
  } catch {
    return null;
  }
}

const storedData = loadStoredData();

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function SunIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ChevronIcon({ open, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`} {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function formatMoney(n) {
  return `₱${n.toFixed(2)}`;
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  const [title, setTitle] = useState(() => storedData?.title ?? '');
  const [people, setPeople] = useState(() => storedData?.people ?? DEFAULT_PEOPLE);
  const [items, setItems] = useState(() => storedData?.items ?? DEFAULT_ITEMS);
  const [serviceCharge, setServiceCharge] = useState(
    () => storedData?.serviceCharge ?? DEFAULT_SERVICE_CHARGE
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, people, items, serviceCharge }));
  }, [title, people, items, serviceCharge]);

  const [newPersonName, setNewPersonName] = useState('');
  const [expandedPeople, setExpandedPeople] = useState({});
  const [exportingImage, setExportingImage] = useState(false);
  const [copiedTotals, setCopiedTotals] = useState(false);
  const shareCardRef = useRef(null);

  // Calculations
  const calculations = useMemo(() => {
    let totalBase = 0;
    let allocatedBase = 0;
    const personSubtotals = {};
    const personOrders = {};
    people.forEach(p => {
      personSubtotals[p.id] = 0;
      personOrders[p.id] = [];
    });

    // Calculate base subtotals and per-person orders
    items.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const itemTotalCost = item.price * qty;
      totalBase += itemTotalCost;
      const validAssignments = item.assignedTo.filter(pid => personSubtotals[pid] !== undefined);
      if (validAssignments.length > 0) {
        allocatedBase += itemTotalCost;
        const costPerPerson = itemTotalCost / validAssignments.length;
        validAssignments.forEach(pid => {
          personSubtotals[pid] += costPerPerson;
          personOrders[pid].push({
            id: item.id,
            name: item.name || 'Untitled item',
            quantity: qty,
            shareCount: validAssignments.length,
            share: costPerPerson,
          });
        });
      }
    });

    // Calculate total service charge
    let totalSc = 0;
    const scBase = serviceCharge.deductVat ? totalBase / (1 + VAT_RATE) : totalBase;
    if (serviceCharge.type === 'percent') {
      totalSc = scBase * (serviceCharge.value / 100);
    } else {
      totalSc = serviceCharge.value;
    }

    const grandTotal = totalBase + totalSc;

    // Calculate per-person totals
    const personTotals = people.map(p => {
      const base = personSubtotals[p.id];
      let scShare = 0;
      
      if (serviceCharge.distribution === 'proportional') {
        scShare = totalBase > 0 ? (base / totalBase) * totalSc : 0;
      } else {
        scShare = people.length > 0 ? totalSc / people.length : 0;
      }

      return {
        ...p,
        base,
        scShare,
        total: base + scShare,
        orders: personOrders[p.id],
      };
    });

    return { totalBase, allocatedBase, totalSc, grandTotal, personTotals };
  }, [people, items, serviceCharge]);

  const togglePersonExpanded = (id) => {
    setExpandedPeople(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const addPerson = () => {
    if (newPersonName.trim()) {
      setPeople([...people, { id: generateId(), name: newPersonName.trim() }]);
      setNewPersonName('');
    }
  };

  const removePerson = (id) => {
    setPeople(people.filter(p => p.id !== id));
    setItems(items.map(item => ({
      ...item,
      assignedTo: item.assignedTo.filter(pid => pid !== id)
    })));
  };

  const addItem = () => {
    setItems([...items, { id: generateId(), name: '', price: 0, quantity: 0, assignedTo: [] }]);
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const toggleAssignment = (itemId, personId) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const isAssigned = item.assignedTo.includes(personId);
        return {
          ...item,
          assignedTo: isAssigned 
            ? item.assignedTo.filter(id => id !== personId)
            : [...item.assignedTo, personId]
        };
      }
      return item;
    }));
  };

  const exportState = () => {
    const state = { title, people, items, serviceCharge };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lunch-out-session.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importState = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const state = JSON.parse(event.target.result);
        if (typeof state.title === 'string') setTitle(state.title);
        if (state.people) setPeople(state.people);
        if (state.items) setItems(state.items);
        if (state.serviceCharge) setServiceCharge(state.serviceCharge);
      } catch (err) {
        alert("Failed to parse file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetSession = () => {
    if (!confirm('Reset title, people, items, and service charge?')) return;
    setTitle('');
    setPeople([]);
    setItems([]);
    setServiceCharge({ ...DEFAULT_SERVICE_CHARGE });
    setExpandedPeople({});
    setNewPersonName('');
  };

  const exportImage = async () => {
    const node = shareCardRef.current;
    if (!node || exportingImage) return;
    setExportingImage(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
      });

      const slug = title.trim()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase() || 'lunch-out';
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${slug}-summary.png`;
      a.click();
    } catch (err) {
      console.error(err);
      alert('Failed to export image.');
    } finally {
      setExportingImage(false);
    }
  };

  const copyTotals = async () => {
    const lines = calculations.personTotals
      .map(pt => `${pt.name}: ${formatMoney(pt.total)}`);
    const trimmedTitle = title.trim();
    const text = trimmedTitle
      ? `${trimmedTitle}\n\n${lines.join('\n')}`
      : lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTotals(true);
      setTimeout(() => setCopiedTotals(false), 1500);
    } catch (err) {
      console.error(err);
      alert('Failed to copy.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12 font-sans selection:bg-accent selection:text-accent-foreground">
      <header className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Lunch Out Splitter</h1>
          <p className="text-muted-foreground mt-2 text-sm">Divide the bill easily, fairly, and minimalist.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="border border-border p-2 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <label className="cursor-pointer text-sm border border-border px-4 py-2 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors">
            Import JSON
            <input type="file" accept=".json" onChange={importState} className="hidden" />
          </label>
          <button onClick={exportState} className="text-sm bg-accent text-accent-foreground px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
            Export JSON
          </button>
          <button
            onClick={resetSession}
            className="text-sm border border-border px-4 py-2 rounded-full text-muted-foreground hover:text-red-400 hover:border-red-400/50 transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-16">

          {/* Title */}
          <section>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday lunch at Mabuhay"
              className="bg-transparent border-b border-border focus:border-foreground outline-none py-2 w-full text-2xl font-medium tracking-tight transition-colors placeholder:font-normal placeholder:text-muted-foreground/60"
            />
          </section>
          
          {/* People Section */}
          <section>
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-lg font-medium">People</h2>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">{people.length} Participants</span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {people.map(p => (
                <div key={p.id} className="group px-4 py-2 border border-border rounded-full text-sm flex items-center gap-2 hover:border-muted-foreground transition-colors">
                  <span>{p.name}</span>
                  <button onClick={() => removePerson(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                    &times;
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input 
                  type="text" 
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPerson()}
                  placeholder="New person..."
                  className="bg-transparent border-b border-border focus:border-foreground outline-none px-2 py-1 text-sm w-32 transition-colors"
                />
                <button onClick={addPerson} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
                  Add
                </button>
              </div>
            </div>
          </section>

          {/* Items Section */}
          <section>
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-lg font-medium">Items</h2>
              <button onClick={addItem} className="text-sm border border-border px-3 py-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors">
                + Add Item
              </button>
            </div>
            
            <div className="space-y-4">
              {items.length === 0 && <p className="text-sm text-muted-foreground">No items added yet.</p>}
              {items.map((item, idx) => (
                <div key={item.id} className="p-5 border border-border rounded-lg space-y-4 hover:border-muted-foreground transition-colors relative group">
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Item Name</label>
                      <input 
                        type="text" 
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        placeholder={`Item ${idx + 1}`}
                        className="bg-transparent border-b border-border focus:border-foreground outline-none py-1 w-full text-base transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Price</label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">₱</span>
                        <input 
                          type="number" 
                          value={item.price || ''}
                          onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="bg-transparent border-b border-border focus:border-foreground outline-none py-1 w-full text-base transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Qty</label>
                      <input 
                        type="number" 
                        value={item.quantity === '' || item.quantity == null ? '' : item.quantity}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateItem(item.id, 'quantity', v === '' ? '' : parseInt(v, 10));
                        }}
                        onBlur={() => {
                          if (item.quantity === '' || item.quantity == null || Number.isNaN(item.quantity) || item.quantity < 0) {
                            updateItem(item.id, 'quantity', 0);
                          }
                        }}
                        placeholder="0"
                        min="0"
                        className="bg-transparent border-b border-border focus:border-foreground outline-none py-1 w-full text-base transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Assigned To</label>
                    <div className="flex gap-2 flex-wrap">
                      {people.map(p => {
                        const isAssigned = item.assignedTo.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleAssignment(item.id, p.id)}
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                              isAssigned
                                ? 'bg-accent text-accent-foreground border-accent'
                                : 'border-border text-muted-foreground hover:border-muted-foreground'
                            }`}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Service Charge Section */}
          <section>
            <h2 className="text-lg font-medium mb-6">Service Charge & Extras</h2>
            <div className="p-6 border border-border rounded-lg space-y-6 hover:border-muted-foreground transition-colors">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Value</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1 border-b border-border focus-within:border-foreground transition-colors">
                      {serviceCharge.type === 'fixed' && <span className="text-muted-foreground">₱</span>}
                      <input 
                        type="number"
                        value={serviceCharge.value || ''}
                        onChange={(e) => setServiceCharge({...serviceCharge, value: parseFloat(e.target.value) || 0})}
                        className="bg-transparent outline-none py-1 w-full text-base"
                      />
                      {serviceCharge.type === 'percent' && <span className="text-muted-foreground">%</span>}
                    </div>
                    <select 
                      value={serviceCharge.type}
                      onChange={(e) => setServiceCharge({...serviceCharge, type: e.target.value})}
                      className="bg-background border border-border rounded text-sm px-2 py-1 outline-none"
                    >
                      <option value="percent">Percent</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Distribution</label>
                  <div className="flex bg-muted rounded p-1">
                    <button 
                      onClick={() => setServiceCharge({...serviceCharge, distribution: 'proportional'})}
                      className={`flex-1 text-sm py-1 rounded transition-colors ${serviceCharge.distribution === 'proportional' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Proportional
                    </button>
                    <button 
                      onClick={() => setServiceCharge({...serviceCharge, distribution: 'equal'})}
                      className={`flex-1 text-sm py-1 rounded transition-colors ${serviceCharge.distribution === 'equal' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Equal
                    </button>
                  </div>
                </div>
              </div>
              {serviceCharge.type === 'percent' && (
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!serviceCharge.deductVat}
                    onChange={(e) => setServiceCharge({ ...serviceCharge, deductVat: e.target.checked })}
                    className="mt-0.5 accent-foreground"
                  />
                  <span>
                    <span className="text-sm block">Deduct 12% VAT before computing</span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      Service charge is applied to subtotal ÷ 1.12
                    </span>
                  </span>
                </label>
              )}
            </div>
          </section>
        </div>

        {/* Summary Section */}
        <div className="lg:col-span-4">
          <div className="p-6 border border-border rounded-xl sticky top-8 bg-background/50 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-lg font-medium">Summary</h2>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={copyTotals}
                  className="text-xs border border-border px-3 py-1.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {copiedTotals ? 'Copied' : 'Copy Totals'}
                </button>
                <button
                  onClick={exportImage}
                  disabled={exportingImage}
                  className="text-xs border border-border px-3 py-1.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                >
                  {exportingImage ? 'Exporting…' : 'Export Image'}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {calculations.personTotals.map(pt => {
                const open = !!expandedPeople[pt.id];
                return (
                  <div key={pt.id} className="border-b border-border/50 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => togglePersonExpanded(pt.id)}
                      className="w-full flex justify-between items-center py-3 text-left gap-3"
                      aria-expanded={open}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ChevronIcon open={open} className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium truncate">{pt.name}</span>
                      </span>
                      <span className="font-medium shrink-0">{formatMoney(pt.total)}</span>
                    </button>
                    {open && (
                      <div className="pb-3 pl-6 space-y-1.5 text-sm">
                        {pt.orders.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No items assigned</p>
                        ) : (
                          pt.orders.map(order => (
                            <div key={order.id} className="flex justify-between gap-3 text-muted-foreground">
                              <span className="min-w-0 text-foreground">{order.name}</span>
                              <span className="shrink-0">{formatMoney(order.share)}</span>
                            </div>
                          ))
                        )}
                        <div className="flex justify-between gap-3 pt-1.5 border-t border-border/40 text-xs text-muted-foreground">
                          <span>Base</span>
                          <span>{formatMoney(pt.base)}</span>
                        </div>
                        {pt.scShare > 0 && (
                          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                            <span>Service charge</span>
                            <span>{formatMoney(pt.scShare)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className="pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney(calculations.totalBase)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Allocated</span>
                  <span className={calculations.allocatedBase < calculations.totalBase ? 'text-red-400' : ''}>
                    {formatMoney(calculations.allocatedBase)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>
                    Service Charge
                    {serviceCharge.type === 'percent' && serviceCharge.deductVat && (
                      <span className="text-xs block">on net of 12% VAT</span>
                    )}
                  </span>
                  <span>{formatMoney(calculations.totalSc)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold text-lg">Total</span>
                  <span className="font-semibold text-lg">{formatMoney(calculations.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Off-screen share card — always expanded for a clean export */}
      <div
        aria-hidden="true"
        className="fixed pointer-events-none"
        style={{ left: '-9999px', top: 0 }}
      >
        <div
          ref={shareCardRef}
          className="p-10 bg-background text-foreground font-sans"
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            width: calculations.personTotals.length <= 3
              ? 480
              : calculations.personTotals.length <= 6
                ? 720
                : 960,
            minHeight: calculations.personTotals.length <= 3
              ? 360
              : calculations.personTotals.length <= 6
                ? 540
                : 720,
          }}
        >
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight">
              {title.trim() || 'Lunch Out Split'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Bill summary</p>
          </div>

          <div
            style={{
              columnCount: calculations.personTotals.length <= 3
                ? 1
                : calculations.personTotals.length <= 6
                  ? 2
                  : 3,
              columnGap: '2rem',
            }}
          >
            {calculations.personTotals.map(pt => (
              <div
                key={pt.id}
                className="pb-4 mb-4 border-b border-border"
                style={{ breakInside: 'avoid' }}
              >
                <div className="flex justify-between items-baseline gap-3 mb-2">
                  <span className="font-medium text-base">{pt.name}</span>
                  <span className="font-semibold">{formatMoney(pt.total)}</span>
                </div>
                <div className="space-y-1 text-sm">
                  {pt.orders.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No items assigned</p>
                  ) : (
                    pt.orders.map(order => (
                      <div key={order.id} className="flex justify-between gap-3 text-muted-foreground">
                        <span>{order.name}</span>
                        <span>{formatMoney(order.share)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between gap-3 pt-1 text-xs text-muted-foreground">
                    <span>Base</span>
                    <span>{formatMoney(pt.base)}</span>
                  </div>
                  {pt.scShare > 0 && (
                    <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                      <span>Service charge</span>
                      <span>{formatMoney(pt.scShare)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 space-y-1.5 text-sm" style={{ breakInside: 'avoid' }}>
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatMoney(calculations.totalBase)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>
                Service Charge
                {serviceCharge.type === 'percent' && (
                  <> ({serviceCharge.value}%{serviceCharge.deductVat ? ', net of VAT' : ''})</>
                )}
              </span>
              <span>{formatMoney(calculations.totalSc)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(calculations.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
