import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

function SkeletonGroupList({ count = 4 }) {
  return (
    <ul className="group-list">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="group-item skeleton-item">
          <div className="sk sk-check" />
          <div className="sk sk-label" style={{ width: `${55 + (i * 13) % 35}%` }} />
        </li>
      ))}
    </ul>
  );
}

export default function GroupSelector({ selected, onChange }) {
  const [available, setAvailable] = useState([]);
  const [saved, setSaved] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('saved');

  useEffect(() => { fetchSaved(); }, []);

  async function fetchSaved() {
    setSavedLoading(true);
    try {
      const res = await apiFetch('/groups/selected');
      if (!res.ok) throw new Error(`${res.status}`);
      setSaved(await res.json());
    } catch (err) {
      console.error('fetchSaved error:', err.message);
    } finally {
      setSavedLoading(false);
    }
  }

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/groups/available');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setAvailable(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addGroup(group) {
    try {
      await apiFetch('/groups/selected', {
        method: 'POST',
        body: JSON.stringify(group),
      });
      await fetchSaved();
    } catch (err) {
      console.error('addGroup error:', err.message);
    }
  }

  async function removeGroup(id) {
    try {
      await apiFetch(`/groups/selected/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSaved(prev => prev.filter(g => g.id !== id));
      onChange(selected.filter(s => s !== id));
    } catch (err) {
      console.error('removeGroup error:', err.message);
    }
  }

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  }

  const allIds = saved.map(g => g.id);
  const allSelected = saved.length > 0 && allIds.every(id => selected.includes(id));
  const someSelected = allIds.some(id => selected.includes(id));

  function toggleAll() {
    if (allSelected) {
      onChange(selected.filter(id => !allIds.includes(id)));
    } else {
      const merged = [...new Set([...selected, ...allIds])];
      onChange(merged);
    }
  }

  const savedIds = new Set(saved.map(g => g.id));

  return (
    <div className="group-selector">
      <div className="tab-bar">
        <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
          My Groups {!savedLoading && `(${saved.length})`}
        </button>
        <button
          className={tab === 'all' ? 'active' : ''}
          onClick={() => { setTab('all'); fetchAll(); }}
        >
          Browse All
        </button>
      </div>

      {tab === 'saved' && (
        <>
          {savedLoading ? (
            <SkeletonGroupList count={4} />
          ) : (
            <>
              {saved.length > 0 && (
                <div className="select-all-bar">
                  <label className="select-all-label">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                    />
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </label>
                  <span className="select-count">
                    {selected.filter(id => allIds.includes(id)).length} / {saved.length} selected
                  </span>
                </div>
              )}

              <ul className="group-list">
                {saved.length === 0 && <li className="empty">No groups added yet. Use Browse All.</li>}
                {saved.map(g => (
                  <li key={g.id} className={`group-item ${selected.includes(g.id) ? 'checked' : ''}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(g.id)}
                        onChange={() => toggle(g.id)}
                      />
                      <span>{g.name}</span>
                    </label>
                    <button className="remove-btn" title="Remove from list" onClick={() => removeGroup(g.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {tab === 'all' && (
        <>
          {loading ? (
            <SkeletonGroupList count={6} />
          ) : error ? (
            <ul className="group-list">
              <li className="empty error-msg">
                {error}
                <button className="retry-btn" onClick={fetchAll}>Retry</button>
              </li>
            </ul>
          ) : (
            <ul className="group-list">
              {available.length === 0 && <li className="empty">No groups found.</li>}
              {available.map(g => (
                <li key={g.id} className="group-item">
                  <span>{g.name}</span>
                  {savedIds.has(g.id)
                    ? <span className="badge">Added</span>
                    : <button className="add-btn" onClick={() => addGroup(g)}>+ Add</button>
                  }
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
