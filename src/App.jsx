import { useState, useMemo } from 'react';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function App() {
  const [people, setPeople] = useState([
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' }
  ]);
  const [items, setItems] = useState([
    { id: 'i1', name: 'Burger', price: 15.00, quantity: 1, assignedTo: ['p1'] },
    { id: 'i2', name: 'Fries', price: 5.00, quantity: 1, assignedTo: ['p1', 'p2'] },
  ]);
  const [serviceCharge, setServiceCharge] = useState({ 
    value: 10, 
    type: 'percent', // 'percent' or 'fixed'
    distribution: 'proportional' // 'proportional' or 'equal'
  });

  const [newPersonName, setNewPersonName] = useState('');

  // Calculations
  const calculations = useMemo(() => {
    let totalBase = 0;
    let allocatedBase = 0;
    const personSubtotals = {};
    people.forEach(p => personSubtotals[p.id] = 0);

    // Calculate base subtotals
    items.forEach(item => {
      const itemTotalCost = item.price * (item.quantity || 1);
      totalBase += itemTotalCost;
      const validAssignments = item.assignedTo.filter(pid => personSubtotals[pid] !== undefined);
      if (validAssignments.length > 0) {
        allocatedBase += itemTotalCost;
        const costPerPerson = itemTotalCost / validAssignments.length;
        validAssignments.forEach(pid => {
          personSubtotals[pid] += costPerPerson;
        });
      }
    });

    // Calculate total service charge
    let totalSc = 0;
    if (serviceCharge.type === 'percent') {
      totalSc = totalBase * (serviceCharge.value / 100);
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
        total: base + scShare
      };
    });

    return { totalBase, allocatedBase, totalSc, grandTotal, personTotals };
  }, [people, items, serviceCharge]);

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
    setItems([...items, { id: generateId(), name: '', price: 0, quantity: 1, assignedTo: [] }]);
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
    const state = { people, items, serviceCharge };
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

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-12 font-sans selection:bg-white selection:text-black">
      <header className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Lunch Out Splitter</h1>
          <p className="text-muted-foreground mt-2 text-sm">Divide the bill easily, fairly, and minimalist.</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer text-sm border border-border px-4 py-2 rounded-full hover:bg-white hover:text-black transition-colors">
            Import JSON
            <input type="file" accept=".json" onChange={importState} className="hidden" />
          </label>
          <button onClick={exportState} className="text-sm bg-white text-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
            Export JSON
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-16">
          
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
              <button onClick={addItem} className="text-sm border border-border px-3 py-1 rounded hover:bg-white hover:text-black transition-colors">
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
                        value={item.quantity || 1}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        placeholder="1"
                        min="1"
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
                                ? 'bg-white text-black border-white' 
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
            </div>
          </section>
        </div>

        {/* Summary Section */}
        <div className="lg:col-span-4">
          <div className="p-6 border border-border rounded-xl sticky top-8 bg-black/50 backdrop-blur-xl">
            <h2 className="text-lg font-medium mb-6">Summary</h2>
            <div className="space-y-4">
              {calculations.personTotals.map(pt => (
                <div key={pt.id} className="flex justify-between items-center pb-4 border-b border-border/50">
                  <div>
                    <div className="font-medium">{pt.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Base: ₱{pt.base.toFixed(2)} {pt.scShare > 0 && `+ SC: ₱${pt.scShare.toFixed(2)}`}
                    </div>
                  </div>
                  <div className="font-medium">₱{pt.total.toFixed(2)}</div>
                </div>
              ))}
              
              <div className="pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₱{calculations.totalBase.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Allocated</span>
                  <span className={calculations.allocatedBase < calculations.totalBase ? 'text-red-400' : ''}>
                    ₱{calculations.allocatedBase.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Service Charge</span>
                  <span>₱{calculations.totalSc.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold text-lg">Total</span>
                  <span className="font-semibold text-lg">₱{calculations.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
