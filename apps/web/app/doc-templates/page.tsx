'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Plus, FileText, X, Download, Edit2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
  body_template: string;
  variables: string[];
  created_at: string;
}

const CATEGORY_STYLE: Record<string, { label: string; cls: string }> = {
  vakalatnama: { label: 'Vakalatnama', cls: 'bg-[#FBF1EE] text-[#6B1E2B]' },
  agreement:   { label: 'Agreement',   cls: 'bg-[#EAF1EC] text-[#3F7A5B]' },
  notice:      { label: 'Notice',      cls: 'bg-[#FDF0EE] text-[#C0392B]' },
  petition:    { label: 'Petition',    cls: 'bg-[#F6ECD8] text-[#9A6B1E]' },
  affidavit:   { label: 'Affidavit',  cls: 'bg-[#F6F1EA] text-[#8A817B]' },
  general:     { label: 'General',     cls: 'bg-[#F3EDE3] text-[#8A817B]' },
};

export default function DocTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generateModal, setGenerateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [previewText, setPreviewText] = useState('');
  const [matters, setMatters] = useState<{ id: string; matter_ref: string; title: string; client: { full_name: string } }[]>([]);
  const [selectedMatter, setSelectedMatter] = useState('');
  const [editForm, setEditForm] = useState({ name: '', category: 'general', description: '', body_template: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [tmplRes, matRes] = await Promise.all([
      supabase.from('document_templates').select('*').order('category').order('name'),
      supabase.from('matters').select('id, matter_ref, title, client:profiles!client_id(full_name)').eq('status', 'active').order('opened_at', { ascending: false }),
    ]);
    if (tmplRes.data) setTemplates(tmplRes.data as Template[]);
    if (matRes.data) setMatters(matRes.data as any[]);
    setLoading(false);
  }

  function openGenerate(tmpl: Template) {
    setSelectedTemplate(tmpl);
    const init: Record<string, string> = {};
    tmpl.variables.forEach((v) => { init[v] = ''; });
    setVarValues(init);
    setSelectedMatter('');
    setPreviewText('');
    setGenerateModal(true);
  }

  function autoFillFromMatter(matterId: string) {
    const m = matters.find((m) => m.id === matterId);
    if (!m) return;
    const today = new Date();
    setVarValues((prev) => ({
      ...prev,
      matter_ref: m.matter_ref,
      matter_title: m.title,
      client_name: (m.client as any).full_name,
      date: String(today.getDate()),
      month: today.toLocaleString('en-PK', { month: 'long' }),
      year: String(today.getFullYear()),
    }));
    setSelectedMatter(matterId);
  }

  function generatePreview() {
    if (!selectedTemplate) return;
    let text = selectedTemplate.body_template;
    Object.entries(varValues).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `[${k}]`);
    });
    setPreviewText(text);
  }

  function downloadTxt() {
    if (!previewText || !selectedTemplate) return;
    const blob = new Blob([previewText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveToMatterDocs() {
    if (!previewText || !selectedTemplate || !selectedMatter) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('documents').insert({
      matter_id: selectedMatter,
      name: selectedTemplate.name,
      category: selectedTemplate.category,
      status: 'uploaded',
      uploaded_by: user?.id,
      source: 'template',
      body: previewText,
    });
    if (user) await supabase.from('audit_logs').insert({
      matter_id: selectedMatter,
      actor_id: user.id,
      actor_type: 'owner',
      action: `Document generated from template: ${selectedTemplate.name}`,
    });
    setSaving(false);
    setGenerateModal(false);
    alert(`"${selectedTemplate.name}" saved to matter documents.`);
  }

  function openEdit(tmpl: Template) {
    setSelectedTemplate(tmpl);
    setEditForm({ name: tmpl.name, category: tmpl.category, description: tmpl.description ?? '', body_template: tmpl.body_template });
    setEditModal(true);
  }

  async function saveEdit() {
    if (!selectedTemplate) return;
    setSaving(true);
    const variables = [...editForm.body_template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const unique = [...new Set(variables)];
    await supabase.from('document_templates').update({
      name: editForm.name,
      category: editForm.category,
      description: editForm.description || null,
      body_template: editForm.body_template,
      variables: unique,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedTemplate.id);
    setSaving(false);
    setEditModal(false);
    load();
  }

  async function createTemplate() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const variables = [...editForm.body_template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const unique = [...new Set(variables)];
    await supabase.from('document_templates').insert({
      name: editForm.name,
      category: editForm.category,
      description: editForm.description || null,
      body_template: editForm.body_template,
      variables: unique,
      created_by: user?.id,
    });
    setSaving(false);
    setCreateModal(false);
    setEditForm({ name: '', category: 'general', description: '', body_template: '' });
    load();
  }

  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <PageShell title="Document Templates" action={
      <button onClick={() => { setEditForm({ name: '', category: 'general', description: '', body_template: '' }); setCreateModal(true); }}
        className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
        <Plus size={16} /> New Template
      </button>
    }>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => (
            <div key={cat}>
              <h2 className="text-xs font-semibold text-[#8A817B] tracking-widest mb-3">
                {CATEGORY_STYLE[cat]?.label?.toUpperCase() ?? cat.toUpperCase()}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {templates.filter((t) => t.category === cat).map((tmpl) => (
                  <div key={tmpl.id} className="bg-white border border-[#ECE4D9] rounded-2xl p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-[#F6F1EA] flex items-center justify-center flex-shrink-0">
                        <FileText size={17} className="text-[#6B1E2B]" strokeWidth={1.7} />
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_STYLE[tmpl.category]?.cls ?? 'bg-[#F3EDE3] text-[#8A817B]'}`}>
                        {CATEGORY_STYLE[tmpl.category]?.label ?? tmpl.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#241D1C] mb-1">{tmpl.name}</h3>
                    {tmpl.description && <p className="text-xs text-[#8A817B] mb-3 leading-relaxed">{tmpl.description}</p>}
                    <p className="text-[10px] text-[#A89F99] mb-4">{tmpl.variables.length} variable{tmpl.variables.length !== 1 ? 's' : ''}</p>
                    <div className="flex gap-2">
                      <button onClick={() => openGenerate(tmpl)} className="flex-1 h-8 rounded-lg bg-[#6B1E2B] text-white text-xs font-semibold hover:bg-[#4A141E] transition-colors">
                        Generate
                      </button>
                      <button onClick={() => openEdit(tmpl)} className="w-8 h-8 rounded-lg border border-[#ECE4D9] flex items-center justify-center text-[#8A817B] hover:bg-[#F6F1EA] transition-colors">
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-center text-sm text-[#A89F99] py-12">No templates yet. Create your first template.</p>
          )}
        </div>
      )}

      {/* Generate Modal */}
      {generateModal && selectedTemplate && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE4D9]">
              <h3 className="text-base font-semibold text-[#241D1C]">Generate: {selectedTemplate.name}</h3>
              <button onClick={() => setGenerateModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F6F1EA] transition-colors">
                <X size={16} className="text-[#8A817B]" />
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Left: variables */}
              <div className="w-72 border-r border-[#ECE4D9] p-5 overflow-y-auto flex-shrink-0">
                <div className="mb-4">
                  <label className="field-label">AUTO-FILL FROM MATTER</label>
                  <select className="field-input" value={selectedMatter} onChange={(e) => autoFillFromMatter(e.target.value)}>
                    <option value="">Select matter…</option>
                    {matters.map((m) => <option key={m.id} value={m.id}>{m.matter_ref} — {m.title}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  {selectedTemplate.variables.map((v) => (
                    <div key={v}>
                      <label className="field-label">{v.toUpperCase().replace(/_/g, ' ')}</label>
                      <input className="field-input" value={varValues[v] ?? ''} onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })} placeholder={`Enter ${v.replace(/_/g, ' ')}`} />
                    </div>
                  ))}
                </div>
                <button onClick={generatePreview} className="w-full mt-5 h-10 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors">
                  Preview Document
                </button>
              </div>
              {/* Right: preview */}
              <div className="flex-1 p-5 overflow-y-auto">
                {previewText ? (
                  <>
                    <div className="bg-[#F6F1EA] rounded-xl p-5 font-mono text-xs text-[#241D1C] whitespace-pre-wrap leading-relaxed">
                      {previewText}
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button onClick={downloadTxt} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#ECE4D9] text-sm font-medium text-[#6E635F] hover:bg-[#F6F1EA] transition-colors">
                        <Download size={14} /> Download .txt
                      </button>
                      {selectedMatter && (
                        <button onClick={saveToMatterDocs} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3F7A5B] text-white text-sm font-semibold hover:bg-[#2D5A42] disabled:opacity-60 transition-colors">
                          {saving ? 'Saving…' : 'Save to Matter Docs'}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <FileText size={32} className="text-[#C5BBB5] mb-3" strokeWidth={1.2} />
                    <p className="text-sm text-[#A89F99]">Fill in the variables and click "Preview Document"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {(editModal || createModal) && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE4D9]">
              <h3 className="text-base font-semibold text-[#241D1C]">{editModal ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={() => { setEditModal(false); setCreateModal(false); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F6F1EA] transition-colors">
                <X size={16} className="text-[#8A817B]" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">NAME</label>
                  <input className="field-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Vakalatnama" />
                </div>
                <div>
                  <label className="field-label">CATEGORY</label>
                  <select className="field-input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                    {Object.entries(CATEGORY_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">DESCRIPTION (OPTIONAL)</label>
                <input className="field-input" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Brief description of when to use this template" />
              </div>
              <div>
                <label className="field-label">TEMPLATE BODY — use {`{{variable_name}}`} for placeholders</label>
                <textarea
                  className="w-full border border-[#ECE4D9] rounded-xl px-4 py-3 bg-[#F6F1EA] text-[#241D1C] text-xs font-mono focus:outline-none focus:border-[#6B1E2B] resize-none"
                  rows={16}
                  value={editForm.body_template}
                  onChange={(e) => setEditForm({ ...editForm, body_template: e.target.value })}
                  placeholder="Enter template text. Use {{client_name}}, {{date}}, etc. as placeholders."
                />
                <p className="text-xs text-[#A89F99] mt-1">
                  Detected variables: {[...editForm.body_template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'none'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-[#ECE4D9]">
              <button onClick={() => { setEditModal(false); setCreateModal(false); }} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={editModal ? saveEdit : createTemplate} disabled={saving || !editForm.name || !editForm.body_template}
                className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : editModal ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .field-label { display: block; font-size: 10px; font-weight: 500; color: #8A817B; letter-spacing: 0.1em; margin-bottom: 6px; }
        .field-input { width: 100%; height: 44px; border: 1px solid #ECE4D9; border-radius: 12px; padding: 0 14px; background: #F6F1EA; color: #241D1C; font-size: 14px; outline: none; }
        .field-input:focus { border-color: #6B1E2B; box-shadow: 0 0 0 1px #6B1E2B; }
      `}</style>
    </PageShell>
  );
}
