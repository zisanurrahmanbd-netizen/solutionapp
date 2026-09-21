import React, { useState, useMemo } from 'react';
import { X, MessageCircle, Mail, Send, Users, AlertTriangle, Loader2, CheckCircle2, Copy, Paperclip, FileSpreadsheet, Link2 } from 'lucide-react';
import { BulkRecipient, renderTemplate, bulkWhatsApp, bulkMailto, normalizeBdPhone, waLink, CUSTOMER_TEMPLATE_DEFAULT, OFFICER_TEMPLATE_DEFAULT } from '../services/messaging';
import { buildAttachment } from '../services/attachmentService';

interface BulkMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Recipients to message — each with name, optional phone/email and template vars */
  recipients: BulkRecipient[];
  /** 'customer' uses the customer reminder template; 'officer' uses the bank-officer template */
  kind?: 'customer' | 'officer';
  /** Optional report to attach. When provided, a format chooser appears
   *  (Excel / PDF / none): the file is uploaded to Supabase Storage and a
   *  download link is appended to every message (WhatsApp cannot send real
   *  file attachments via deep links). */
  attachment?: {
    fileName: string;
    headers: string[];
    rows: any[][];
    label?: string;
    buildFile?: (format: 'xlsx' | 'pdf') => { fileName: string; headers: string[]; rows: any[][] };
  } | null;
}

export const BulkMessageModal: React.FC<BulkMessageModalProps> = ({ isOpen, onClose, recipients, kind = 'customer', attachment = null }) => {
  const defaultTemplate = kind === 'officer' ? OFFICER_TEMPLATE_DEFAULT : CUSTOMER_TEMPLATE_DEFAULT;
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [subject, setSubject] = useState(kind === 'officer' ? 'Portfolio Discussion — {{company}}' : 'Payment Reminder — {{company}}');
  const [template, setTemplate] = useState(defaultTemplate);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [blocked, setBlocked] = useState<{ phone: string; message: string; name: string }[]>([]);
  const [done, setDone] = useState(false);
  const [includeAttachment, setIncludeAttachment] = useState(!!attachment);
  const [attachFormat, setAttachFormat] = useState<'xlsx' | 'pdf' | 'none'>('xlsx');
  const [attachUrl, setAttachUrl] = useState<string | null>(null);
  const [attachErr, setAttachErr] = useState<string | null>(null);

  const hasWhatsApp = useMemo(() => recipients.filter(r => normalizeBdPhone(r.phone)).length, [recipients]);
  const hasEmail = useMemo(() => recipients.filter(r => (r.email || '').trim()).length, [recipients]);

  if (!isOpen) return null;

  const targets = recipients.filter(r =>
    channel === 'whatsapp' ? !!normalizeBdPhone(r.phone) : !!(r.email || '').trim()
  );

  const handleSend = async () => {
    setBlocked([]);
    setDone(false);
    setAttachErr(null);
    if (targets.length === 0) return;

    // Build + upload the report attachment first (if requested)
    let link: string | null = null;
    if (includeAttachment && attachFormat !== 'none' && attachment) {
      setSending(true);
      try {
        const chosen = attachFormat === 'pdf' ? 'pdf' : 'xlsx';
        const spec = attachment.buildFile
          ? { ...attachment, ...attachment.buildFile(chosen) }
          : attachment;
        link = await buildAttachment({ ...spec, format: chosen, title: attachment.label || 'File Update Report' });
        setAttachUrl(link);
      } catch (e: any) {
        setAttachErr(e?.message || 'Could not upload the attachment.');
        setSending(false);
        return;
      }
      setSending(false);
    }

    const suffix = link ? `\n\n📎 Report: ${link}` : '';

    if (channel === 'whatsapp') {
      setSending(true);
      setProgress({ sent: 0, total: targets.length });
      const payload = targets.map(r => ({
        phone: normalizeBdPhone(r.phone)!,
        message: renderTemplate(template, r) + suffix,
        name: r.name,
      }));
      // Opening many tabs needs the user gesture — run immediately
      const res = await bulkWhatsApp(payload, (sent, total) => setProgress({ sent, total }));
      setBlocked(res.blocked.map(b => ({ ...b, name: payload.find(p => p.phone === b.phone)?.name || b.phone })));
      setSending(false);
      setDone(true);
    } else {
      const emails = targets.map(r => r.email!.trim());
      bulkMailto(emails, renderTemplate(subject, { key: 0, name: '' }), renderTemplate(template, { key: 0, name: '' }) + suffix);
      setDone(true);
    }
  };

  const total = channel === 'whatsapp' ? hasWhatsApp : hasEmail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            Send Message to Multiple Recipients
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">✕</button>
        </div>

        {done ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {channel === 'email'
                  ? 'Your email app opened with the message pre-filled. Review and press Send.'
                  : `Opened WhatsApp for ${progress.sent} of ${progress.total} recipient(s).`}
              </div>
            </div>
            {blocked.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  Popups blocked for {blocked.length} recipient(s) — tap each below to open manually:
                </div>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {blocked.map(b => (
                    <a
                      key={b.phone}
                      href={waLink(b.phone, b.message)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all"
                    >
                      {b.name || b.phone} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Recipient count + channel switch */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {targets.length} of {recipients.length} selected recipient(s) have a {channel === 'whatsapp' ? 'phone number' : 'email'}
              </span>
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-0.5">
                <button
                  onClick={() => setChannel('whatsapp')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${channel === 'whatsapp' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  onClick={() => setChannel('email')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${channel === 'email' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>
            </div>

            {channel === 'whatsapp' && hasWhatsApp < recipients.length && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                ⚠ {recipients.length - hasWhatsApp} recipient(s) have no/invalid phone number and will be skipped.
              </p>
            )}
            {channel === 'email' && hasEmail < recipients.length && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                ⚠ {recipients.length - hasEmail} recipient(s) have no email and will be skipped.
              </p>
            )}

            {channel === 'email' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs"
                />
              </div>
            )}

            {/* Attachment format chooser */}
            {attachment && (
              <div className={`p-3 rounded-xl border space-y-2 ${includeAttachment && attachFormat !== 'none' ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Attach file update ({attachment.rows.length} files)
                  </span>
                  <div className="ml-auto flex rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5">
                    {(['xlsx', 'pdf', 'none'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => { setAttachFormat(f); setIncludeAttachment(f !== 'none'); }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all ${
                          attachFormat === f
                            ? f === 'none'
                              ? 'bg-slate-600 text-white shadow'
                              : f === 'pdf'
                                ? 'bg-rose-600 text-white shadow'
                                : 'bg-emerald-600 text-white shadow'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {f === 'xlsx' ? 'Excel' : f === 'pdf' ? 'PDF' : 'None'}
                      </button>
                    ))}
                  </div>
                </div>
                {includeAttachment && attachFormat !== 'none' && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    The {attachFormat === 'pdf' ? 'PDF' : 'Excel'} report uploads to secure cloud storage and a download link is added to the end of every message (WhatsApp deep links can't carry real files).
                  </p>
                )}
                {attachUrl && (
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Uploaded — link ready
                  </p>
                )}
                {attachErr && (
                  <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {attachErr}
                  </p>
                )}
              </div>
            )}

            {/* Template editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Message (same for everyone)</label>
                <button
                  onClick={() => setTemplate(defaultTemplate)}
                  className="text-[10px] font-bold text-blue-500 hover:text-blue-600"
                >
                  Reset template
                </button>
              </div>
              <textarea
                value={template}
                onChange={e => setTemplate(e.target.value)}
                rows={8}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono leading-relaxed"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] font-bold text-slate-400">Variables:</span>
                {['{{name}}', ...Object.keys(recipients[0]?.vars || {}).map(k => `{{${k}}}`)].map(v => (
                  <button
                    key={v}
                    onClick={() => setTemplate(t => t + ' ' + v)}
                    className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold font-mono hover:bg-blue-500/20 transition-all"
                  >
                    {v}
                  </button>
                ))}
                <button
                  onClick={() => { navigator.clipboard?.writeText(renderTemplate(template, recipients[0] || { key: 0, name: '' })); }}
                  className="ml-auto flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Copy preview with first recipient's values"
                >
                  <Copy className="w-3 h-3" /> Copy preview
                </button>
              </div>
              {/* Live preview with first recipient */}
              {recipients[0] && (
                <div className="mt-2 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">Preview (first recipient — {recipients[0].name}):</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{renderTemplate(template, recipients[0])}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-[11px] font-semibold text-slate-400">
                {channel === 'whatsapp'
                  ? 'WhatsApp opens chat-by-chat with your message pre-filled — press send for each.'
                  : 'Opens your email app with all recipients and the message pre-filled.'}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={targets.length === 0 || sending || !template.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sending ? `Sending ${progress.sent}/${progress.total}…` : `Send to ${targets.length}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
