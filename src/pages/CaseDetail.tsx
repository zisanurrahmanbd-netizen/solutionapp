import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { useLanguage } from '../context/LanguageContext';
import { dataService } from '../services/dataService';
import { StatusBadge } from '../components/StatusBadge';
import { CaseVisitMap } from '../components/CaseVisitMap';
import { formatDate } from '../services/dateFormat';
import { CaseFile, CheckIn, Collection, CaseRemark } from '../types';
import { 
  ArrowLeft, MapPin, Phone, PhoneCall, Mail, Coins, Calendar, Clock, 
  MessageSquare, Receipt, Navigation, UserCheck, Building2,
  ExternalLink, CheckCircle2, Compass, CreditCard, FileSpreadsheet,
  User as UserIcon, ShieldCheck, Edit3, Briefcase, Camera, Plus, X, Image
} from 'lucide-react';

export const CaseDetail: React.FC<{ caseId: number; onBack: () => void }> = ({ caseId, onBack }) => {
  const { user, users } = useAuth();
  const { can } = usePermissions();
  const { t } = useLanguage();
  const [caseItem, setCaseItem] = useState<CaseFile | undefined>();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [remarks, setRemarks] = useState<CaseRemark[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCol, setShowCol] = useState(false);
  const [showRem, setShowRem] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);

  // Customer & Employment Edit form fields
  const [editPhone, setEditPhone] = useState('');
  const [editRefPhone, setEditRefPhone] = useState('');
  const [editPresentAddress, setEditPresentAddress] = useState('');
  const [editPermanentAddress, setEditPermanentAddress] = useState('');
  const [editEmpOfficeName, setEditEmpOfficeName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editEmpOfficeAddress, setEditEmpOfficeAddress] = useState('');

  // Multiple Guarantors / References (dynamic array)
  const [editGuarantors, setEditGuarantors] = useState<{ name: string; phone: string; address: string }[]>([]);

  // Photo upload states (base64)
  const [checkPhoto, setCheckPhoto] = useState('');
  const [colPhoto, setColPhoto] = useState('');
  const [remPhoto, setRemPhoto] = useState('');

  // Hidden file input refs
  const checkPhotoRef = useRef<HTMLInputElement>(null);
  const colPhotoRef = useRef<HTMLInputElement>(null);
  const remPhotoRef = useRef<HTMLInputElement>(null);

  const [addrType, setAddrType] = useState<'present' | 'permanent'>('present');
  const [checkNotes, setCheckNotes] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy?: number; time: string } | null>(null);

  const [colAmt, setColAmt] = useState('');
  const [colDate, setColDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [colMethod, setColMethod] = useState<'cash' | 'bank_deposit' | 'cheque'>('cash');
  const [colRec, setColRec] = useState('');

  const [remContact, setRemContact] = useState<'contacted' | 'uncontacted' | 'door_locked' | 'shifted'>('contacted');
  const [remDisposition, setRemDisposition] = useState<'promise' | 'paid' | 'missed_reschedule' | 'refused' | 'unable_to_pay'>('promise');
  const [remReason, setRemReason] = useState('');
  const [remPtpAmt, setRemPtpAmt] = useState('');
  const [remPtpDate, setRemPtpDate] = useState('');
  const [remText, setRemText] = useState('');
  const [selAgentId, setSelAgentId] = useState(4);

  // Helper: convert File to base64
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const reload = () => {
    setCaseItem(dataService.getCaseById(caseId));
    setCheckIns(dataService.getCheckInsByCase(caseId));
    setRemarks(dataService.getRemarksByCase(caseId));
    setCollections(dataService.getCollectionsByCase(caseId));
  };

  useEffect(() => { reload(); }, [caseId]);

  if (!caseItem) return <div className="p-8 text-center"><button onClick={onBack}>Back</button></div>;

  const handleStartCheckIn = () => {
    setShowCheckIn(true);
    setIsLocating(true);
    const nowTime = new Date().toLocaleString();

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            time: nowTime
          });
          setIsLocating(false);
        },
        () => {
          setGpsCoords({
            lat: 23.7945 + (Math.random() - 0.5) * 0.01,
            lng: 90.4088 + (Math.random() - 0.5) * 0.01,
            accuracy: 8,
            time: nowTime
          });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsCoords({ lat: 23.8103, lng: 90.4125, accuracy: 10, time: nowTime });
      setIsLocating(false);
    }
  };

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!checkPhoto) {
      alert('Photo proof is required for GPS Check-In! Please capture or upload a photo.');
      return;
    }
    dataService.addCheckIn({
      case_file_id: caseItem.id,
      agent_id: user.id,
      address_type: addrType,
      latitude: gpsCoords?.lat || 23.8103,
      longitude: gpsCoords?.lng || 90.4125,
      accuracy: gpsCoords?.accuracy || 8,
      notes: checkNotes,
      photo_url: checkPhoto,
      visited_at: new Date().toISOString(),
    });
    setShowCheckIn(false);
    setCheckNotes('');
    setCheckPhoto('');
    reload();
  };

  const handleCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !colAmt) return;
    dataService.addCollection({
      case_file_id: caseItem.id,
      agent_id: user.id,
      amount: Number(colAmt),
      payment_method: colMethod,
      receipt_number: colRec || ('REC-' + Date.now().toString().slice(-6)),
      photo_url: colPhoto || undefined,
      collected_at: colDate ? new Date(colDate).toISOString() : new Date().toISOString(),
    });
    setShowCol(false);
    setColAmt('');
    setColPhoto('');
    setColDate(new Date().toISOString().split('T')[0]);
    reload();
  };

  const handleRemark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (remDisposition === 'paid') {
      setShowRem(false);
      setShowCol(true);
      return;
    }

    const fullRemark = remReason 
      ? `[${remDisposition.toUpperCase()} - Reason: ${remReason}] ${remText}`.trim() 
      : remText;

    dataService.addRemark({
      case_file_id: caseItem.id,
      user_id: user.id,
      contact_status: remContact,
      promised_amount: (remDisposition === 'promise' || remDisposition === 'missed_reschedule') && remPtpAmt ? Number(remPtpAmt) : undefined,
      promise_date: (remDisposition === 'promise' || remDisposition === 'missed_reschedule') ? (remPtpDate || undefined) : undefined,
      remarks: fullRemark || `Status update: ${remDisposition.replace('_', ' ')}`,
      photo_url: remPhoto || undefined,
      created_at: new Date().toISOString(),
    });

    setShowRem(false);
    setRemText('');
    setRemReason('');
    setRemPhoto('');
    reload();
  };

  const handleReassign = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.reassignCase(caseItem.id, selAgentId);
    setShowReassign(false);
    reload();
  };

  const handleOpenEditCustomer = () => {
    if (!caseItem) return;
    setEditPhone(caseItem.customer_phone || '');
    setEditRefPhone(caseItem.customer_secondary_phone || String(caseItem.extra_attributes?.REF_PHONE || caseItem.extra_attributes?.ref_phone || ''));
    setEditPresentAddress(caseItem.customer_address_present || '');
    setEditPermanentAddress(caseItem.customer_address_permanent || '');
    setEditEmpOfficeName(String(caseItem.extra_attributes?.EMP_OFFICE_NAME || caseItem.extra_attributes?.emp_office_name || ''));
    setEditPosition(String(caseItem.extra_attributes?.POSITION || caseItem.extra_attributes?.position || ''));
    setEditEmpOfficeAddress(String(caseItem.extra_attributes?.EMP_OFFICE_ADDRESS || caseItem.extra_attributes?.emp_office_address || ''));
    // Load guarantors from extra_attributes
    try {
      const raw = caseItem.extra_attributes?.GUARANTORS;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      setEditGuarantors(Array.isArray(parsed) ? parsed : []);
    } catch { setEditGuarantors([]); }
    setShowEditCustomer(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseItem) return;
    dataService.updateCase(caseItem.id, {
      customer_phone: editPhone.trim(),
      customer_secondary_phone: editRefPhone.trim(),
      customer_address_present: editPresentAddress.trim(),
      customer_address_permanent: editPermanentAddress.trim(),
      extra_attributes: {
        ...(caseItem.extra_attributes || {}),
        EMP_OFFICE_NAME: editEmpOfficeName.trim(),
        POSITION: editPosition.trim(),
        EMP_OFFICE_ADDRESS: editEmpOfficeAddress.trim(),
        REF_PHONE: editRefPhone.trim(),
        GUARANTORS: JSON.stringify(editGuarantors),
      }
    });
    setShowEditCustomer(false);
    reload();
  };

  const agents = users.filter(u => u.role === 'agent');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button onClick={onBack} className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-emerald-500 transition-all w-fit">
          <ArrowLeft className="w-4 h-4" /> {t('detail.back', 'Back to Bank & MNC Files')}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleOpenEditCustomer} 
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition-all"
            title="Edit mobile numbers, addresses, and employer workplace details"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Customer & Workplace</span>
          </button>
          {can('gps_checkin') && (
            <button onClick={handleStartCheckIn} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all">
              <Navigation className="w-3.5 h-3.5" /> {t('detail.gps_checkin', 'GPS Visit Check-In')}
            </button>
          )}
          {can('log_remark') && (
            <button onClick={() => setShowRem(true)} className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all">
              <MessageSquare className="w-3.5 h-3.5" /> {t('detail.log_remark', 'Log Remark / PTP')}
            </button>
          )}
          {can('record_payment') && (
            <button onClick={() => setShowCol(true)} className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all">
              <Receipt className="w-3.5 h-3.5" /> {t('detail.record_payment', 'Record Payment')}
            </button>
          )}
          {can('reassign_case') && (
            <button onClick={() => setShowReassign(true)} className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700">
              <UserCheck className="w-3.5 h-3.5" /> {t('detail.reassign', 'Reassign')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Case Info Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{caseItem.file_number}</span>
                  {caseItem.agent_name && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      <span>Agent: {caseItem.agent_name}</span>
                    </span>
                  )}
                  {(caseItem.extra_attributes?.['COLLECTOR'] || caseItem.extra_attributes?.['C.S'] || caseItem.extra_attributes?.['CS'] || caseItem.extra_attributes?.['SUPERVISOR']) && (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Collector/CS: {String(caseItem.extra_attributes?.['COLLECTOR'] || caseItem.extra_attributes?.['C.S'] || caseItem.extra_attributes?.['CS'] || caseItem.extra_attributes?.['SUPERVISOR'])}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">{caseItem.customer_name}</h2>
                  <button 
                    onClick={handleOpenEditCustomer} 
                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
              <StatusBadge status={caseItem.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="text-slate-400 font-bold text-[10px] uppercase">{t('cases.bank_product', 'Bank / Partner')}</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{caseItem.bank?.name || 'Bank'}</p>
                <p className="text-slate-500 text-[11px] truncate">{caseItem.product?.name || caseItem.extra_attributes?.['PRODUCT'] || 'Portfolio'}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="text-slate-400 font-bold text-[10px] uppercase">{t('detail.account_no', 'Account / Card #')}</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">{caseItem.account_number || 'N/A'}</p>
                <p className="text-slate-500 text-[11px] font-mono font-semibold">Allocated: {formatDate(caseItem.allocation_date) || 'N/A'}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="text-slate-400 font-bold text-[10px] uppercase">{t('detail.phone', 'Primary Contact')}</span>
                {caseItem.customer_phone ? (
                  <a href={'tel:' + caseItem.customer_phone} className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline truncate">
                    <Phone className="w-3 h-3" />
                    <span>{caseItem.customer_phone}</span>
                  </a>
                ) : (
                  <span className="text-slate-400 font-medium">N/A</span>
                )}
                <p className="text-slate-500 text-[11px]">Alt: {caseItem.customer_secondary_phone || 'None'}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="text-slate-400 font-bold text-[10px] uppercase">{t('detail.expiry_date', 'Contract Expiry')}</span>
                <p className="font-mono font-bold text-amber-600 dark:text-amber-400">{formatDate(caseItem.expiry_date) || 'N/A'}</p>
                <p className="text-slate-500 text-[11px] truncate font-semibold">{caseItem.legal_status || 'Normal Recovery'}</p>
              </div>
            </div>

            {/* Bank Officer & Institutional Contact for this File */}
            {(() => {
              const allBankContacts = dataService.getContacts();
              const matchingContacts = allBankContacts.filter(c => {
                if (c.bank_id !== caseItem.bank_id) return false;
                if (caseItem.collector_name && c.name && c.name.toLowerCase().trim() === caseItem.collector_name.toLowerCase().trim()) return true;
                return true;
              });
              if (matchingContacts.length === 0 && !caseItem.collector_name) return null;

              return (
                <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Bank Recovery Liaison & Officer Contact</span>
                    </span>
                    {caseItem.collector_name && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
                        Assigned Officer: {caseItem.collector_name}
                      </span>
                    )}
                  </div>
                  {matchingContacts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {matchingContacts.map((bc, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white truncate">{bc.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{bc.designation || 'Bank Official'}{bc.department ? ` • ${bc.department}` : ''}</div>
                            {bc.branch && <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">Branch: {bc.branch}</div>}
                          </div>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                            {bc.phone && (
                              <a href={`tel:${bc.phone}`} className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline">
                                <PhoneCall className="w-3 h-3" />
                                <span>{bc.phone}</span>
                              </a>
                            )}
                            {bc.email && (
                              <a href={`mailto:${bc.email}`} className="flex items-center gap-1 text-slate-500 hover:text-blue-600 truncate ml-auto" title={bc.email}>
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[110px]">{bc.email}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                      Officer named in file: <strong>{caseItem.collector_name}</strong>. You can register their direct phone number in the Bank Contacts directory.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Target Address Visit Status */}
            <div className="space-y-3 pt-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    <span>{t('detail.present_address', 'Present Residence Address')}</span>
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">{caseItem.customer_address_present || 'No address provided'}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  caseItem.present_address_visited ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}>
                  {caseItem.present_address_visited ? (t('top.switch_lang') === 'English' ? '✓ ভিজিট সম্পন্ন' : '✓ Visited') : (t('top.switch_lang') === 'English' ? 'ভিজিট বাকি' : 'Pending Visit')}
                </span>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                    <Building2 className="w-4 h-4 text-purple-500" />
                    <span>{t('detail.permanent_address', 'Permanent Origin Address')}</span>
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">{caseItem.customer_address_permanent || 'No permanent address'}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  caseItem.permanent_address_visited ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}>
                  {caseItem.permanent_address_visited ? (t('top.switch_lang') === 'English' ? '✓ ভিজিট সম্পন্ন' : '✓ Visited') : (t('top.switch_lang') === 'English' ? 'ভিজিট বাকি' : 'Pending Visit')}
                </span>
              </div>
            </div>

            {/* EXTENDED BANK FILE ATTRIBUTES & CUSTOM DATA */}
            {caseItem.extra_attributes && Object.keys(caseItem.extra_attributes).length > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-950 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 pt-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                    <span>Extended Bank File Details & Allocation Attributes</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Object.keys(caseItem.extra_attributes).length} Attributes Recorded
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {Object.entries(caseItem.extra_attributes).map(([key, val], idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block truncate">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px] block truncate mt-0.5">
                        {String(val ?? 'N/A')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 🏢 WORKPLACE & EMPLOYMENT INFORMATION CARD */}
          {(caseItem.extra_attributes?.EMP_OFFICE_NAME || caseItem.extra_attributes?.POSITION || caseItem.extra_attributes?.EMP_OFFICE_ADDRESS || caseItem.customer_secondary_phone || caseItem.extra_attributes?.REF_PHONE) && (
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Briefcase className="w-4 h-4 text-amber-500" />
                  <span>Workplace & Employment Info</span>
                </h3>
                <button
                  onClick={handleOpenEditCustomer}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {(caseItem.extra_attributes?.EMP_OFFICE_NAME) && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block mb-0.5">Company / Employer</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{String(caseItem.extra_attributes.EMP_OFFICE_NAME)}</span>
                  </div>
                )}
                {(caseItem.extra_attributes?.POSITION) && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block mb-0.5">Job Position / Designation</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{String(caseItem.extra_attributes.POSITION)}</span>
                  </div>
                )}
                {(caseItem.extra_attributes?.REF_PHONE || caseItem.customer_secondary_phone) && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block mb-0.5">Reference Phone</span>
                    <a 
                      href={`tel:${caseItem.extra_attributes?.REF_PHONE || caseItem.customer_secondary_phone}`}
                      className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{String(caseItem.extra_attributes?.REF_PHONE || caseItem.customer_secondary_phone)}</span>
                    </a>
                  </div>
                )}
                {(caseItem.extra_attributes?.EMP_OFFICE_ADDRESS) && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl sm:col-span-3">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block mb-0.5">Employer / Office Address</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{String(caseItem.extra_attributes.EMP_OFFICE_ADDRESS)}</span>
                  </div>
                )}
              </div>

              {/* Guarantors / References list */}
              {(() => {
                try {
                  const raw = caseItem.extra_attributes?.GUARANTORS;
                  const guarantors = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
                  if (!Array.isArray(guarantors) || guarantors.length === 0) return null;
                  return (
                    <div className="pt-2 border-t border-amber-500/10">
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">👥 Ref / Guarantors</p>
                      <div className="space-y-2">
                        {guarantors.map((g: any, idx: number) => (
                          <div key={idx} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{g.name || `Guarantor ${idx + 1}`}</span>
                              {g.phone && (
                                <a href={`tel:${g.phone}`} className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline">
                                  <Phone className="w-3 h-3" />{g.phone}
                                </a>
                              )}
                            </div>
                            {g.address && <p className="text-slate-500 mt-0.5">{g.address}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
          )}

          {/* CALL HISTORY, REMARKS & PTP PROMISES */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-900 dark:text-white">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <span>{t('detail.call_history', 'Remarks, Call Logs & Promise to Pay (PTP)')} ({remarks.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Conversations, contact statuses, payment commitments, and field notes
                </p>
              </div>
              {can('log_remark') && (
                <button
                  onClick={() => setShowRem(true)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Remark</span>
                </button>
              )}
            </div>

            <div className="space-y-3 pt-1">
              {remarks.length === 0 ? (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  <MessageSquare className="w-5 h-5 mx-auto mb-1 opacity-40" />
                  <p>No conversation remarks or PTP records logged yet.</p>
                </div>
              ) : (
                remarks.map(r => {
                  const hasPtp = r.promise_date || r.promised_amount;
                  const isPtpOverdue = r.promise_date && r.promise_date < new Date().toISOString().split('T')[0];

                  return (
                    <div
                      key={'rem-' + r.id}
                      className={`p-4 rounded-2xl border space-y-2 text-xs transition-all ${
                        hasPtp
                          ? isPtpOverdue
                            ? 'bg-rose-500/5 border-rose-500/30 dark:bg-rose-950/10'
                            : 'bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/10'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.contact_status === 'contacted'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : r.contact_status === 'refused'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}>
                            {r.contact_status.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            by {r.user?.name || 'Agent'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* PTP Details Badge if present */}
                      {hasPtp && (
                        <div className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                          isPtpOverdue
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold uppercase text-[10px] tracking-wide">
                              {isPtpOverdue ? '⚠️ Missed Promise to Pay (PTP)' : '🤝 Promise to Pay (PTP)'}:
                            </span>
                            {r.promised_amount && (
                              <span className="font-black font-mono text-xs">
                                BDT {r.promised_amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {r.promise_date && (
                            <span className="font-mono text-[11px] font-semibold">
                              Date: {r.promise_date} {isPtpOverdue ? '(Overdue)' : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Remark text */}
                      <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        {r.remarks}
                      </p>

                      {/* Photo if attached */}
                      {r.photo_url && (
                        <div className="pt-1">
                          <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1 mb-1">
                            <Camera className="w-3 h-3" /> Attached Proof Photo
                          </span>
                          <img src={r.photo_url} alt="remark proof" className="rounded-xl max-h-36 object-cover border border-blue-500/20" />
                        </div>
                      )}

                      {/* Delete button */}
                      {can('log_remark') && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              if (confirm('Delete this remark / PTP record permanently?')) {
                                dataService.deleteRemark(r.id);
                                reload();
                              }
                            }}
                            className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-rose-600 font-bold px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                          >
                            🗑 Delete Remark / PTP
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* VERIFIED GPS PINPOINT VISIT RECORDS & EMBEDDED MAP */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-900 dark:text-white">
                <Compass className="w-4 h-4 text-purple-500" />
                <span>{t('detail.visit_history', 'Verified GPS Field Check-Ins')} ({checkIns.length})</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pinpoint coordinates, exact visited address, exact timestamp, and agent validation
              </p>
            </div>

            {/* Embedded Mini Pinpoint Map */}
            <CaseVisitMap checkIns={checkIns} caseItem={caseItem} />

            {/* Detailed Check-In Records List */}
            <div className="space-y-3 pt-2">
              {checkIns.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  <Navigation className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p>No GPS field visit check-ins recorded yet for this case.</p>
                  <p className="text-[11px] mt-1">Agents can tap "{t('detail.gps_checkin', 'GPS Visit Check-In')}" to log location & timestamp.</p>
                </div>
              ) : (
                checkIns.map(ci => {
                  const isPresent = ci.address_type === 'present';
                  const addressVisited = isPresent ? caseItem.customer_address_present : caseItem.customer_address_permanent;

                  return (
                    <div
                      key={'ci-' + ci.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs transition-all hover:border-purple-500/40"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                            isPresent 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          }`}>
                            <MapPin className="w-3 h-3" />
                            <span>{ci.address_type} Address Visited</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            by {ci.agent?.name || 'Agent'} ({ci.agent?.employee_id || 'AGT'})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5 text-purple-500" />
                          <span>{new Date(ci.visited_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Visited Address string */}
                      <div className="text-slate-800 dark:text-slate-200 font-medium flex items-start gap-1.5">
                        <span className="text-slate-400 font-bold">{t('cases.status') === 'à¦…à¦¬à¦¸à§à¦¥à¦¾' ? 'à¦ à¦¿à¦•à¦¾à¦¨à¦¾:' : 'Address:'}</span>
                        <span>{addressVisited || 'Address record on file'}</span>
                      </div>

                      {/* GPS Pinpoint Info & Google Maps link */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                          <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                            Lat: {ci.latitude.toFixed(6)}, Lng: {ci.longitude.toFixed(6)}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            ({t('map.accuracy', 'Accuracy')}: Â±{ci.accuracy || 8}m)
                          </span>
                        </div>

                        <a
                          href={`https://www.google.com/maps?q=${ci.latitude},${ci.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-600 hover:text-white text-purple-600 dark:text-purple-400 font-bold text-[11px] transition-all w-fit"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{t('detail.open_google_maps', 'Open in Google Maps')}</span>
                        </a>
                      </div>

                      {ci.notes && (
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                          <span className="font-bold text-slate-900 dark:text-white">{t('detail.visit_outcome', 'Visit Outcome')}:</span> {ci.notes}
                        </div>
                      )}
                      {ci.photo_url && (
                        <div className="mt-1">
                          <span className="text-[10px] font-bold text-purple-500 flex items-center gap-1 mb-1"><Camera className="w-3 h-3" /> Visit Proof Photo</span>
                          <img src={ci.photo_url} alt="visit proof" className="rounded-xl max-h-40 object-cover border border-purple-500/20 w-full" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Financials */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Coins className="w-4 h-4 text-emerald-500" />
              <span>{t('detail.financials', 'Financial Balances')}</span>
            </h3>

            <div className="space-y-2.5">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{t('cases.outstanding', 'Total Outstanding')}</span>
                <p className="text-xl font-black font-mono text-slate-900 dark:text-white">BDT {caseItem.outstanding_amount.toLocaleString()}</p>
              </div>

              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <span className="text-[10px] font-bold text-rose-500 uppercase">{t('cases.overdue', 'Overdue Amount')}</span>
                <p className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">BDT {caseItem.overdue_amount.toLocaleString()}</p>
              </div>

              {caseItem.minimum_payment ? (
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                  <span className="text-[10px] font-bold text-blue-500 uppercase">Monthly EMI / Min Due</span>
                  <p className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">BDT {caseItem.minimum_payment.toLocaleString()}</p>
                </div>
              ) : null}

              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">{t('detail.collected_amount', 'Total Collected')}</span>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">BDT {caseItem.total_collected_amount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white"><Receipt className="w-4 h-4 text-emerald-500" /> {t('detail.receipts', 'Receipts')}</h3>
            {collections.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">No payments recorded yet.</p>
            )}
            {collections.map(c => {
              const st = c.status || 'pending';
              const stColor = st === 'approved' ? 'emerald' : st === 'rejected' ? 'rose' : 'amber';
              return (
                <div key={c.id} className={`p-3 rounded-2xl text-xs space-y-1.5 border ${
                  st === 'rejected' 
                    ? 'bg-rose-500/5 border-rose-500/20' 
                    : st === 'approved'
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-amber-500/5 border-amber-500/20'
                }`}>
                  <div className="flex justify-between font-bold">
                    <span className={`text-${stColor}-600 dark:text-${stColor}-400`}>BDT {c.amount.toLocaleString()}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-${stColor}-500/10 text-${stColor}-600 dark:text-${stColor}-400 uppercase`}>
                        {st === 'approved' ? '✓ Verified' : st === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{c.receipt_number}</span>
                    </div>
                  </div>
                  {st === 'rejected' && c.rejection_reason && (
                    <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium bg-rose-500/10 px-2 py-1 rounded-lg">
                      ⚠️ Rejected: {c.rejection_reason}
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span className="capitalize">{c.payment_method?.replace('_', ' ')}</span>
                    <span>{new Date(c.collected_at).toLocaleDateString()}</span>
                  </div>
                  {c.photo_url && (
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mb-1"><Camera className="w-3 h-3" /> Payment Proof</span>
                      <img src={c.photo_url} alt="payment proof" className="rounded-xl max-h-32 object-cover border border-emerald-500/20 w-full" />
                    </div>
                  )}
                  {can('record_payment') && (
                    <div className="flex justify-end pt-0.5">
                      <button
                        onClick={() => {
                          if (confirm('Delete this payment record permanently?')) {
                            dataService.deleteCollection(c.id);
                            reload();
                          }
                        }}
                        className="text-[10px] flex items-center gap-1 text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                      >
                        🗑 Delete Record
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* GPS CHECK-IN MODAL */}
      {showCheckIn && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleCheckInSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-purple-500 animate-pulse" />
                <span>{t('detail.gps_checkin', 'GPS Field Visit Check-In')}</span>
              </h3>
              <button type="button" onClick={() => setShowCheckIn(false)} className="text-slate-400 hover:text-white">âœ•</button>
            </div>

            {/* GPS Signal Status Badge */}
            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-600 dark:text-purple-300 flex items-center gap-1.5">
                  <Compass className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                  {isLocating ? t('detail.satellite_acquiring', 'Acquiring GPS Satellite Signal...') : t('detail.satellite_locked', 'GPS Coordinates Locked')}
                </span>
                {gpsCoords && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Â±{gpsCoords.accuracy || 6}m {t('map.accuracy', 'Precision')}
                  </span>
                )}
              </div>
              {gpsCoords && (
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  Lat: {gpsCoords.lat.toFixed(6)}, Lng: {gpsCoords.lng.toFixed(6)}
                </div>
              )}
              <div className="text-[10px] text-slate-400">
                Timestamp: {gpsCoords?.time || new Date().toLocaleString()}
              </div>
            </div>

            {/* Select Visited Address */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                {t('detail.select_visited_addr', 'Select Address Visited:')}
              </label>
              
              <label className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                addrType === 'present' 
                  ? 'bg-emerald-500/10 border-emerald-500 text-slate-900 dark:text-white font-bold'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                <input
                  type="radio"
                  name="address_choice"
                  checked={addrType === 'present'}
                  onChange={() => setAddrType('present')}
                  className="mt-0.5 text-emerald-600"
                />
                <div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{t('detail.present_address', 'Present Residence Address')}</div>
                  <div className="text-[11px] font-normal text-slate-600 dark:text-slate-400 mt-0.5">
                    {caseItem.customer_address_present || 'Present residence on file'}
                  </div>
                </div>
              </label>

              <label className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                addrType === 'permanent' 
                  ? 'bg-purple-500/10 border-purple-500 text-slate-900 dark:text-white font-bold'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                <input
                  type="radio"
                  name="address_choice"
                  checked={addrType === 'permanent'}
                  onChange={() => setAddrType('permanent')}
                  className="mt-0.5 text-purple-600"
                />
                <div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-bold">{t('detail.permanent_address', 'Permanent Origin Address')}</div>
                  <div className="text-[11px] font-normal text-slate-600 dark:text-slate-400 mt-0.5">
                    {caseItem.customer_address_permanent || 'Permanent origin on file'}
                  </div>
                </div>
              </label>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('detail.visit_notes_label', 'Visit Notes / Observations:')}
              </label>
              <textarea
                required
                rows={3}
                value={checkNotes}
                onChange={e => setCheckNotes(e.target.value)}
                placeholder="e.g. Met customer at residence, verified identity, discussed payment commitment..."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Photo Upload - Mandatory */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-purple-500" /> Proof Photo <span className="text-rose-500 font-black">* (Required)</span>
              </label>
              <input
                ref={checkPhotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) setCheckPhoto(await fileToBase64(file));
                }}
              />
              <button
                type="button"
                onClick={() => checkPhotoRef.current?.click()}
                className={`w-full p-2.5 rounded-xl border-2 border-dashed font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  checkPhoto 
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                    : 'border-purple-400/40 hover:border-purple-500 bg-purple-500/5 text-purple-600 dark:text-purple-400'
                }`}
              >
                <Camera className="w-4 h-4" />
                {checkPhoto ? '✓ Photo Selected (Tap to Change)' : '📷 Capture / Upload Proof Photo (Required)'}
              </button>
              {checkPhoto ? (
                <div className="mt-2 relative">
                  <img src={checkPhoto} alt="preview" className="rounded-xl max-h-36 object-cover w-full border border-purple-500/20" />
                  <button type="button" onClick={() => setCheckPhoto('')} className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 hover:bg-rose-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-rose-500 font-semibold mt-1">
                  * A live camera or gallery photo is required to submit GPS check-in.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setShowCheckIn(false)} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300">
                {t('detail.cancel', 'Cancel')}
              </button>
              <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-md shadow-purple-600/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('detail.submit_checkin', 'Submit Verified Check-In')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Payment Modal */}
      {showCol && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleCollection} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-3 text-xs shadow-2xl">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('detail.record_payment', 'Record Payment')}</h3>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Collection Amount (BDT) *</label>
              <input type="number" required value={colAmt} onChange={e => setColAmt(e.target.value)} placeholder="Amount (BDT)" className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Payment Date *</label>
              <input type="date" required value={colDate} onChange={e => setColDate(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Payment Method</label>
              <select value={colMethod} onChange={e => setColMethod(e.target.value as any)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                <option value="cash">{t('top.switch_lang') === 'English' ? 'নগদ (Cash)' : 'Cash'}</option>
                <option value="bank_deposit">{t('top.switch_lang') === 'English' ? 'ব্যাংক জমা' : 'Bank Deposit'}</option>
                <option value="cheque">{t('top.switch_lang') === 'English' ? 'চেক' : 'Cheque'}</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Money Receipt Number (optional)</label>
              <input type="text" value={colRec} onChange={e => setColRec(e.target.value)} placeholder="Receipt # (optional)" className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
            </div>

            {/* Payment Proof Photo */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-500" /> Payment Proof Photo (optional)
              </label>
              <input
                ref={colPhotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) setColPhoto(await fileToBase64(file));
                }}
              />
              <button
                type="button"
                onClick={() => colPhotoRef.current?.click()}
                className="w-full p-2.5 rounded-xl border-2 border-dashed border-emerald-400/40 hover:border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Camera className="w-4 h-4" />
                {colPhoto ? 'Change Photo' : 'Capture / Upload Receipt Photo'}
              </button>
              {colPhoto && (
                <div className="mt-2 relative">
                  <img src={colPhoto} alt="preview" className="rounded-xl max-h-32 object-cover w-full border border-emerald-500/20" />
                  <button type="button" onClick={() => setColPhoto('')} className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 hover:bg-rose-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCol(false)} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold">{t('detail.cancel', 'Cancel')}</button>
              <button type="submit" className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-md shadow-emerald-600/30">{t('detail.save_payment', 'Save Payment')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Log Remark Modal */}
      {showRem && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleRemark} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-3 text-xs shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('detail.log_remark', 'Log Contact Remark / PTP')}</h3>
            {/* Contact Status */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Status</label>
              <select value={remContact} onChange={e => setRemContact(e.target.value as any)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold">
                <option value="contacted">{t('top.switch_lang') === 'English' ? 'গ্রাহকের সাথে কথা হয়েছে' : 'Customer Contacted'}</option>
                <option value="uncontacted">{t('top.switch_lang') === 'English' ? 'যোগাযোগ সম্ভব হয়নি' : 'Unreachable'}</option>
                <option value="door_locked">{t('top.switch_lang') === 'English' ? 'দরজায় তালাবদ্ধ' : 'Door Locked'}</option>
                <option value="shifted">{t('top.switch_lang') === 'English' ? 'ঠিকানা পরিবর্তন করেছে' : 'Shifted'}</option>
                <option value="refused">Refused to Talk / Settle</option>
              </select>
            </div>

            {/* PTP / Payment Outcome Option */}
            <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 space-y-2">
              <label className="block font-bold text-blue-700 dark:text-blue-400 uppercase text-[10px]">
                Follow-Up / PTP Action Type
              </label>
              <select
                value={remDisposition}
                onChange={e => setRemDisposition(e.target.value as any)}
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-xs"
              >
                <option value="promise">🤝 New Promise to Pay (PTP)</option>
                <option value="paid">💰 Customer Paid Now (Record Collection)</option>
                <option value="missed_reschedule">🔄 Missed PTP Re-Entry (Reschedule with Reason)</option>
                <option value="unable_to_pay">⚠️ Cannot Pay Right Now (Financial Hardship)</option>
                <option value="refused">❌ Refused to Pay / Disputed Claim</option>
              </select>

              {/* Conditional: If Paid, show tip */}
              {remDisposition === 'paid' && (
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                  ✓ Clicking continue will take you directly to <b>Record Payment</b> with receipt and photo upload.
                </div>
              )}

              {/* Conditional: If Missed Re-entry or Cannot Pay or Refused, require Reason */}
              {(remDisposition === 'missed_reschedule' || remDisposition === 'unable_to_pay' || remDisposition === 'refused') && (
                <div className="space-y-1 pt-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                    {remDisposition === 'missed_reschedule' && 'Why did the customer miss the previous payment? *'}
                    {remDisposition === 'unable_to_pay' && 'Why can customer not pay right now? *'}
                    {remDisposition === 'refused' && 'Reason for refusal / dispute *'}
                  </label>
                  <select
                    value={remReason}
                    onChange={e => setRemReason(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-xs"
                  >
                    <option value="">-- Select Reason --</option>
                    <option value="Salary / business fund delayed">Salary or business income delayed</option>
                    <option value="Medical / family emergency expense">Medical or family emergency</option>
                    <option value="Out of town / travelling">Out of station / Travelling</option>
                    <option value="Loss of job / business closed down">Loss of job or business closed down</option>
                    <option value="Banking / transfer channel technical issue">Bank app or transfer issue</option>
                    <option value="Disputes interest / outstanding amount calculation">Disputes interest / charges calculation</option>
                    <option value="Claims already paid / settlement pending">Claims already paid earlier</option>
                    <option value="Strictly refused to settle with agency">Refused to cooperate with agency</option>
                    <option value="Other valid reason">Other reason (explain below)</option>
                  </select>
                </div>
              )}

              {/* Conditional: If Promise or Missed Reschedule, show amount and when will pay date */}
              {(remDisposition === 'promise' || remDisposition === 'missed_reschedule') && (
                <div className="space-y-1.5 pt-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                    {remDisposition === 'missed_reschedule' ? 'Rescheduled PTP Amount & When Will Pay Date *' : 'Committed PTP Amount & Date'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="number" 
                      value={remPtpAmt} 
                      onChange={e => setRemPtpAmt(e.target.value)} 
                      placeholder="Committed Amount" 
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold" 
                    />
                    <input 
                      type="date" 
                      value={remPtpDate} 
                      onChange={e => setRemPtpDate(e.target.value)} 
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold" 
                    />
                  </div>
                </div>
              )}
            </div>

            <textarea required rows={3} value={remText} onChange={e => setRemText(e.target.value)} placeholder="Enter detailed conversation notes..." className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />

            {/* Remark Proof Photo */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-500" /> Remark Proof Photo (optional)
              </label>
              <input
                ref={remPhotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) setRemPhoto(await fileToBase64(file));
                }}
              />
              <button
                type="button"
                onClick={() => remPhotoRef.current?.click()}
                className="w-full p-2.5 rounded-xl border-2 border-dashed border-blue-400/40 hover:border-blue-500 bg-blue-500/5 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Camera className="w-4 h-4" />
                {remPhoto ? 'Change Photo' : 'Capture / Upload Proof Photo'}
              </button>
              {remPhoto && (
                <div className="mt-2 relative">
                  <img src={remPhoto} alt="preview" className="rounded-xl max-h-32 object-cover w-full border border-blue-500/20" />
                  <button type="button" onClick={() => setRemPhoto('')} className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 hover:bg-rose-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowRem(false)} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold">{t('detail.cancel', 'Cancel')}</button>
              <button type="submit" className="px-3.5 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md shadow-blue-600/30">{t('detail.save_remark', 'Save Remark')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Reassign Case Modal */}
      {showReassign && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleReassign} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-3 text-xs shadow-2xl">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('detail.reassign', 'Reassign Case File')}</h3>
            <select value={selAgentId} onChange={e => setSelAgentId(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold">
              {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.employee_id})</option>)}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowReassign(false)} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold">{t('detail.cancel', 'Cancel')}</button>
              <button type="submit" className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-bold">{t('detail.save_reassign', 'Save Assignment')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Customer & Workplace Info Modal */}
      {showEditCustomer && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveCustomer}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 text-xs shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                Edit Customer & Workplace Info
              </h3>
              <button
                type="button"
                onClick={() => setShowEditCustomer(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Contact Numbers */}
            <div>
              <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">📱 Contact Numbers</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Primary Mobile</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Reference Phone</label>
                  <input
                    type="tel"
                    value={editRefPhone}
                    onChange={e => setEditRefPhone(e.target.value)}
                    placeholder="Ref / Alt number"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div>
              <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">📍 Addresses</p>
              <div className="space-y-2">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Present Residence Address</label>
                  <textarea
                    rows={2}
                    value={editPresentAddress}
                    onChange={e => setEditPresentAddress(e.target.value)}
                    placeholder="Current residential address..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Permanent Origin Address</label>
                  <textarea
                    rows={2}
                    value={editPermanentAddress}
                    onChange={e => setEditPermanentAddress(e.target.value)}
                    placeholder="Permanent / village address..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Employment */}
            <div>
              <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">🏢 Employment / Workplace</p>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Company / Employer</label>
                    <input
                      type="text"
                      value={editEmpOfficeName}
                      onChange={e => setEditEmpOfficeName(e.target.value)}
                      placeholder="Company name..."
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Job Position / Designation</label>
                    <input
                      type="text"
                      value={editPosition}
                      onChange={e => setEditPosition(e.target.value)}
                      placeholder="e.g. Manager, Engineer..."
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Employer / Office Address</label>
                  <textarea
                    rows={2}
                    value={editEmpOfficeAddress}
                    onChange={e => setEditEmpOfficeAddress(e.target.value)}
                    placeholder="Workplace address..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Guarantors / References – multiple entries */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">👥 Ref / Guarantor Details</p>
                <button
                  type="button"
                  onClick={() => setEditGuarantors(g => [...g, { name: '', phone: '', address: '' }])}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-[11px] hover:bg-amber-500/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Ref / Guarantor
                </button>
              </div>

              {editGuarantors.length === 0 && (
                <p className="text-[11px] text-slate-400 italic text-center py-2">
                  No guarantors added yet. Tap "+ Add Ref / Guarantor" to begin.
                </p>
              )}

              <div className="space-y-3">
                {editGuarantors.map((g, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2 relative">
                    <button
                      type="button"
                      onClick={() => setEditGuarantors(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Guarantor #{idx + 1}</p>
                    <input
                      type="text"
                      value={g.name}
                      onChange={e => setEditGuarantors(prev => prev.map((item, i) => i === idx ? { ...item, name: e.target.value } : item))}
                      placeholder="Guarantor / Ref Name"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-500/20 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                    <input
                      type="tel"
                      value={g.phone}
                      onChange={e => setEditGuarantors(prev => prev.map((item, i) => i === idx ? { ...item, phone: e.target.value } : item))}
                      placeholder="Phone number"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-500/20 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                    <textarea
                      rows={2}
                      value={g.address}
                      onChange={e => setEditGuarantors(prev => prev.map((item, i) => i === idx ? { ...item, address: e.target.value } : item))}
                      placeholder="Address"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-500/20 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEditCustomer(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-md shadow-amber-600/30 flex items-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};