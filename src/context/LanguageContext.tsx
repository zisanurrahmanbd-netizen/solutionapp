import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export type Language = 'en' | 'bn';

// ═══════════════════════════════════════════════════════════════════════
// Static UI strings (used via t('key'))
// ═══════════════════════════════════════════════════════════════════════

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Nav Items
    'nav.dashboard': 'Dashboard',
    'nav.cases': 'Bank & MNC Files',
    'nav.map': 'Live Agent Map',
    'nav.imports': 'Excel Templates & Import',
    'nav.contacts': 'Bank Contacts',
    'nav.reports_perf': 'Agent Performance',
    'nav.reports_expiry': 'Expiry Tracker',
    'nav.reports_legal': 'Legal & Flagged Cases',
    'nav.team': 'Team Management',

    // Top Bar & Controls
    'top.permissions': 'Permissions',
    'top.branding': 'Edit Logo & Brand',
    'top.search_placeholder': 'Quick search file #, customer, phone...',
    'top.live_status': 'Supabase Live',
    'top.sign_out': 'Sign Out',
    'top.quick_persona': 'Quick Persona Switch',
    'top.dark_mode': 'Dark Mode',
    'top.light_mode': 'Light Mode',
    'top.language': 'English',
    'top.switch_lang': 'বাংলা',

    // Status Badges
    'status.new': 'New',
    'status.in_progress': 'In Progress',
    'status.visited': 'Visited',
    'status.broken_promise': 'Broken Promise',
    'status.disputed': 'Disputed',
    'status.legal': 'Legal Case',
    'status.untraceable': 'Untraceable',
    'status.settled': 'Settled',
    'status.closed': 'Closed',

    // Dashboard
    'dash.title': 'Recovery Operations Control Center',
    'dash.subtitle': 'Real-time telemetry, portfolio recovery KPIs and field team operations',
    'dash.total_allocated': 'Total Portfolio Assigned',
    'dash.total_collected': 'Total Cash Collected',
    'dash.recovery_rate': 'Recovery Success Rate',
    'dash.active_agents': 'Active Field Agents',
    'dash.overdue_portfolio': 'Overdue & At-Risk Balance',
    'dash.ptp_today': 'Promises Due Today (PTP)',
    'dash.recent_collections': 'Live Field Collections',
    'dash.performance_overview': 'Bank Recovery Portfolio Mix',
    'dash.urgent_followups': 'Urgent Follow-Ups & Missed PTP',
    'dash.due_today_desc': 'Click to view & follow up',
    'dash.overdue_desc': 'Overdue commitment dates',
    'dash.cases_count': 'Cases',
    'dash.active_recovery_cases': 'active recovery cases',

    // Case Registry
    'cases.title': 'Bank & MNC Files',
    'cases.subtitle': 'assigned institutional bank & corporate recovery files',
    'cases.search': 'Search file, name, phone, account...',
    'cases.all_banks': 'All Partner Banks',
    'cases.all_statuses': 'All Statuses',
    'cases.export_excel': 'Export Excel (.XLSX)',
    'cases.file_no': 'File Number',
    'cases.customer': 'Customer & Details',
    'cases.bank_product': 'Bank / Product',
    'cases.outstanding': 'Outstanding',
    'cases.status': 'Status',
    'cases.agent': 'Assigned Agent',
    'cases.action': 'Action',
    'cases.view_detail': 'View File',

    // Case Detail
    'detail.back': 'Back to Bank & MNC Files',
    'detail.gps_checkin': 'GPS Visit Check-In',
    'detail.log_remark': 'Log Remark / PTP',
    'detail.record_payment': 'Record Payment',
    'detail.reassign': 'Reassign',
    'detail.financials': 'Financial Balances',
    'detail.outstanding_amount': 'Total Outstanding',
    'detail.collected_amount': 'Total Collected',
    'detail.present_address': 'Present Residence Address',
    'detail.permanent_address': 'Permanent Origin Address',
    'detail.visit_history': 'Verified Field GPS Check-In History',
    'detail.open_google_maps': 'Open in Google Maps',
    'detail.contact_remarks': 'Contact History & Remarks',
    'detail.receipts': 'Payment Receipts & Slips',
    'detail.account_no': 'Account / Card #',
    'detail.phone': 'Primary Phone',
    'detail.alt_phone': 'Secondary Phone',
    'detail.allocation_date': 'Allocation Date',
    'detail.expiry_date': 'Expiry Date',
    'detail.visit_outcome': 'Visit Outcome',
    'detail.satellite_locked': 'GPS Coordinates Locked',
    'detail.satellite_acquiring': 'Acquiring GPS Satellite Signal...',
    'detail.select_visited_addr': 'Select Address Visited:',
    'detail.visit_notes_label': 'Visit Notes / Observations:',
    'detail.submit_checkin': 'Submit Verified Check-In',
    'detail.cancel': 'Cancel',
    'detail.save_payment': 'Save Payment',
    'detail.save_remark': 'Save Remark',
    'detail.save_reassign': 'Save Assignment',

    // Live Map
    'map.title': 'Live Field Agent Telemetry & GPS Tracking',
    'map.subtitle': 'Real-time satellite & cellular check-in locations of field recovery agents',
    'map.online_agents': 'Online Field Agents',
    'map.search_agents': 'Search agent by name or ID...',
    'map.active_status': 'Active On Field',
    'map.offline_status': 'Offline / Away',
    'map.last_ping': 'Last GPS Ping',
    'map.accuracy': 'Precision',

    // Excel Importer
    'import.title': 'Excel File Importer & Institutional Templates',
    'import.subtitle': 'Upload portfolio files, map standard banking columns and bulk ingest accounts',
    'import.upload_box': 'Drag and drop .xlsx file here or browse device',
    'import.download_template': 'Download Standard Bank Template',
    'import.select_bank': 'Select Partner Bank',
    'import.select_sheet': 'Select Worksheet',
    'import.inspect_preview': 'Inspect & Validate File',
    'import.start_import': 'Queue & Execute Import',
    'import.recent_jobs': 'Recent File Import Jobs',

    // Bank Contacts
    'contacts.title': 'Partner Bank & Institutional Directory',
    'contacts.subtitle': 'Direct official phone & email contacts for recovery managers and branch coordinators',
    'contacts.add_new': 'Add New Bank Contact',
    'contacts.search': 'Search contact, designation, or branch...',
    'contacts.name': 'Name & Designation',
    'contacts.department': 'Department',
    'contacts.phone': 'Phone Number',
    'contacts.email': 'Official Email',
    'contacts.bank': 'Institution',
    'contacts.branch': 'Branch',

    // Agent Performance
    'perf.title': 'Agent Performance & KPI Leaderboard',
    'perf.subtitle': 'Recovery targets, field visit frequency, and collected volume rankings',
    'perf.export': 'Export Performance CSV',
    'perf.from_date': 'From Date',
    'perf.to_date': 'To Date',
    'perf.manager_filter': 'Reporting Manager',
    'perf.rank': 'Rank',
    'perf.agent_name': 'Agent Name',
    'perf.total_files': 'Total Files',
    'perf.visited_files': 'Visited',
    'perf.collections_count': 'Receipts',
    'perf.total_collected': 'Collected Amount',
    'perf.avg_collection': 'Avg. / Collection',

    // Expiry Tracker
    'expiry.title': 'Portfolio Expiry Matrix & Allocation Tracker',
    'expiry.subtitle': 'Monitor contract expiration buckets across partner banks and recovery mandates',
    'expiry.expiring_7': 'Expiring in 7 Days',
    'expiry.expiring_30': 'Expiring in 30 Days',
    'expiry.expired': 'Expired Mandates',
    'expiry.active': 'Active Accounts',

    // Flagged Cases
    'legal.title': 'Legal & Flagged Accounts Registry',
    'legal.subtitle': 'Litigation cases, broken promises, dispute resolutions and untraceable accounts',
    'legal.all': 'All Flagged Files',
    'legal.proceedings': 'Legal Proceedings',
    'legal.untraceable': 'Untraceable / Shifted',
    'legal.broken': 'Broken Promises (PTP)',
    'legal.disputed': 'Disputed Accounts',

    // Team Management
    'team.title': 'Team & User Management',
    'team.subtitle': 'Create, edit, assign roles, and manage field agents and recovery managers',
    'team.add_user': 'Add New User / Agent',
    'team.perms_btn': 'Roles & Permissions Control',
    'team.search': 'Search by name, email, or employee ID...',
    'team.all_roles': 'All Roles',
    'team.role_admin': 'Administrator',
    'team.role_manager': 'Team Manager',
    'team.role_agent': 'Field Agent',
    'team.activate': 'Activate',
    'team.deactivate': 'Deactivate',
    'team.edit': 'Edit',
    'team.delete': 'Delete',
    'team.perms': 'Perms',

    // Login
    'login.signin_title': 'Recovery Agent & Staff Portal',
    'login.signin_subtitle': 'Enter your institutional credentials to access debt portfolio operations',
    'login.email': 'Email Address',
    'login.password': 'Password',
    'login.remember': 'Remember this device',
    'login.submit': 'Sign In to Dashboard',
    'login.demo_personas': '1-Click Demo Personas',
    'login.demo_ready': 'Demo Ready',
  },
  bn: {
    // Nav Items
    'nav.dashboard': 'ড্যাশবোর্ড',
    'nav.cases': 'ব্যাংক ও এমএনসি ফাইলসমূহ',
    'nav.map': 'লাইভ এজেন্ট ম্যাপ',
    'nav.imports': 'এক্সেল টেমপ্লেট ও ইমপোর্ট',
    'nav.contacts': 'ব্যাংক পরিচিতি ও নম্বর',
    'nav.reports_perf': 'এজেন্ট পারফরম্যান্স',
    'nav.reports_expiry': 'মেয়াদ ট্র্যাকার',
    'nav.reports_legal': 'আইনি ও চিহ্নিত ফাইলসমূহ',
    'nav.team': 'টিম ও ইউজার ম্যানেজমেন্ট',

    // Top Bar & Controls
    'top.permissions': 'অনুমতিসমূহ',
    'top.branding': 'লোগো ও ব্র্যান্ড পরিবর্তন',
    'top.search_placeholder': 'ফাইল নম্বর, নাম বা মোবাইল দিয়ে খুঁজুন...',
    'top.live_status': 'সুপাবেস লাইভ',
    'top.sign_out': 'লগআউট',
    'top.quick_persona': 'দ্রুত ইউজার পরিবর্তন',
    'top.dark_mode': 'ডার্ক মোড',
    'top.light_mode': 'লাইট মোড',
    'top.language': 'বাংলা',
    'top.switch_lang': 'English',

    // Status Badges
    'status.new': 'নতুন',
    'status.in_progress': 'চলমান',
    'status.visited': 'ভিজিট সম্পন্ন',
    'status.broken_promise': 'ভাঙ্গা প্রতিশ্রুতি',
    'status.disputed': 'বিতর্কিত',
    'status.legal': 'আইনি মামলা',
    'status.untraceable': 'অচিহ্নিত',
    'status.settled': 'নিষ্পত্তিকৃত',
    'status.closed': 'বন্ধ',

    // Dashboard
    'dash.title': 'রিকভারি অপারেশন কন্ট্রোল সেন্টার',
    'dash.subtitle': 'রিয়েল-টাইম তথ্য, পোর্টফোলিও আদায় ট্র্যাকিং ও ফিল্ড টিম পরিচালনা',
    'dash.total_allocated': 'মোট বরাদ্দকৃত পোর্টফোলিও',
    'dash.total_collected': 'মোট সংগৃহীত নগদ টাকা',
    'dash.recovery_rate': 'আদায়ের সাফল্যের হার',
    'dash.active_agents': 'সক্রিয় ফিল্ড এজেন্ট',
    'dash.overdue_portfolio': 'মেয়াদোত্তীর্ণ ও ঝুঁকিপূর্ণ বকেয়া',
    'dash.ptp_today': 'আজকের প্রতিশ্রুত আদায় (PTP)',
    'dash.recent_collections': 'সর্বশেষ ফিল্ড কালেকশন',
    'dash.performance_overview': 'ব্যাংক রিকভারি পোর্টফোলিও পরিসংখ্যান',
    'dash.urgent_followups': 'জরুরি ফলো-আপ ও বকেয়া প্রতিশ্রুতি',
    'dash.due_today_desc': 'দেখতে ও ফলো-আপ করতে ক্লিক করুন',
    'dash.overdue_desc': 'মেয়াদোত্তীর্ণ প্রতিশ্রুতির তারিখ',
    'dash.cases_count': 'টি ফাইল',
    'dash.active_recovery_cases': 'টি সক্রিয় রিকভারি ফাইল',

    // Case Registry
    'cases.title': 'ব্যাংক ও এমএনসি ফাইলসমূহ',
    'cases.subtitle': 'বরাদ্দকৃত প্রাতিষ্ঠানিক ব্যাংক ও কর্পোরেট রিকভারি ফাইল',
    'cases.search': 'ফাইল নং, নাম, ফোন বা একাউন্ট দিয়ে খুঁজুন...',
    'cases.all_banks': 'সকল অংশীদার ব্যাংক',
    'cases.all_statuses': 'সকল স্ট্যাটাস',
    'cases.export_excel': 'এক্সেল ডাউনলোড (.XLSX)',
    'cases.file_no': 'ফাইল নম্বর',
    'cases.customer': 'গ্রাহক ও বিস্তারিত',
    'cases.bank_product': 'ব্যাংক / পণ্য',
    'cases.outstanding': 'মোট বকেয়া',
    'cases.status': 'অবস্থা',
    'cases.agent': 'নিয়োজিত এজেন্ট',
    'cases.action': 'পদক্ষেপ',
    'cases.view_detail': 'ফাইল দেখুন',

    // Case Detail
    'detail.back': 'ব্যাংক ও এমএনসি ফাইলে ফিরে যান',
    'detail.gps_checkin': 'জিপিএস ভিজিট চেক-ইন',
    'detail.log_remark': 'মন্তব্য ও পিটিপি সংরক্ষণ',
    'detail.record_payment': 'পেমেন্ট জমা দিন',
    'detail.reassign': 'পুনর্বণ্টন করুন',
    'detail.financials': 'আর্থিক হিসাব বিবরণী',
    'detail.outstanding_amount': 'মোট বকেয়া টাকা',
    'detail.collected_amount': 'মোট আদায়কৃত টাকা',
    'detail.present_address': 'বর্তমান বাসস্থান ঠিকানা',
    'detail.permanent_address': 'স্থায়ী মূল ঠিকানা',
    'detail.visit_history': 'যাচাইকৃত ফিল্ড জিপিএস চেক-ইন ইতিহাস',
    'detail.open_google_maps': 'গুগল ম্যাপে দেখুন',
    'detail.contact_remarks': 'যোগাযোগ ও মন্তব্যের ইতিহাস',
    'detail.receipts': 'মানি রসিদ ও ভাউচার',
    'detail.account_no': 'একাউন্ট / কার্ড নং',
    'detail.phone': 'প্রধান মোবাইল নম্বর',
    'detail.alt_phone': 'বিকল্প মোবাইল নম্বর',
    'detail.allocation_date': 'বরাদ্দের তারিখ',
    'detail.expiry_date': 'মেয়াদোত্তীর্ণের তারিখ',
    'detail.visit_outcome': 'ভিজিটের ফলাফল',
    'detail.satellite_locked': 'জিপিএস স্থানাঙ্ক লক করা হয়েছে',
    'detail.satellite_acquiring': 'জিপিএস স্যাটেলাইট সংকেত খোঁজা হচ্ছে...',
    'detail.select_visited_addr': 'পরিদর্শনকৃত ঠিকানা নির্বাচন করুন:',
    'detail.visit_notes_label': 'ভিজিটের পর্যবেক্ষণ / মন্তব্য:',
    'detail.submit_checkin': 'যাচাইকৃত চেক-ইন জমা দিন',
    'detail.cancel': 'বাতিল',
    'detail.save_payment': 'পেমেন্ট সংরক্ষণ করুন',
    'detail.save_remark': 'মন্তব্য সংরক্ষণ করুন',
    'detail.save_reassign': 'নিয়োগ সংরক্ষণ করুন',

    // Live Map
    'map.title': 'লাইভ ফিল্ড এজেন্ট ট্র্যাকিং ও জিপিএস ম্যাপ',
    'map.subtitle': 'ফিল্ড রিকভারি এজেন্টদের রিয়েল-টাইম স্যাটেলাইট ও নেটওয়ার্ক চেক-ইন অবস্থান',
    'map.online_agents': 'অনলাইন ফিল্ড এজেন্টসমূহ',
    'map.search_agents': 'নাম বা আইডি দিয়ে খুঁজুন...',
    'map.active_status': 'ফিল্ডে সক্রিয়',
    'map.offline_status': 'অফলাইন / দূরে',
    'map.last_ping': 'সর্বশেষ জিপিএস পিং',
    'map.accuracy': 'নির্ভুলতা',

    // Excel Importer
    'import.title': 'এক্সেল ফাইল ইমপোর্টার ও প্রাতিষ্ঠানিক টেমপ্লেট',
    'import.subtitle': 'পোর্টফোলিও ফাইল আপলোড, স্ট্যান্ডার্ড ব্যাংকিং কলাম ম্যাপিং এবং বাল্ক ফাইল সংযোজন',
    'import.upload_box': '.xlsx ফাইল এখানে ড্রপ করুন অথবা ডিভাইস থেকে বেছে নিন',
    'import.download_template': 'স্ট্যান্ডার্ড ব্যাংক টেমপ্লেট ডাউনলোড',
    'import.select_bank': 'অংশীদার ব্যাংক নির্বাচন করুন',
    'import.select_sheet': 'ওয়ার্কশিট নির্বাচন করুন',
    'import.inspect_preview': 'ফাইল যাচাই ও প্রিভিউ',
    'import.start_import': 'ইমপোর্ট শুরু করুন',
    'import.recent_jobs': 'সাম্প্রতিক ফাইল ইমপোর্ট ইতিহাস',

    // Bank Contacts
    'contacts.title': 'অংশীদার ব্যাংক ও প্রাতিষ্ঠানিক পরিচিতি ডিরেক্টরি',
    'contacts.subtitle': 'রিকভারি ম্যানেজার ও শাখা সমন্বয়কারীদের অফিসিয়াল ফোন ও ইমেইল তালিকা',
    'contacts.add_new': 'নতুন ব্যাংক পরিচিতি যোগ করুন',
    'contacts.search': 'নাম, পদবি বা শাখা দিয়ে খুঁজুন...',
    'contacts.name': 'নাম ও পদবি',
    'contacts.department': 'বিভাগ',
    'contacts.phone': 'ফোন নম্বর',
    'contacts.email': 'অফিসিয়াল ইমেইল',
    'contacts.bank': 'ব্যাংক / প্রতিষ্ঠান',
    'contacts.branch': 'শাখা',

    // Agent Performance
    'perf.title': 'এজেন্ট পারফরম্যান্স ও কেপিআই লিডারবোর্ড',
    'perf.subtitle': 'আদায় লক্ষ্যমাত্রা, ফিল্ড ভিজিট ও সংগৃহীত টাকার ভিত্তিতে তৈরি রেটিং',
    'perf.export': 'পারফরম্যান্স সিএসভি ডাউনলোড',
    'perf.from_date': 'শুরুর তারিখ',
    'perf.to_date': 'শেষ তারিখ',
    'perf.manager_filter': 'দায়িত্বপ্রাপ্ত ম্যানেজার',
    'perf.rank': 'র‍্যাংক',
    'perf.agent_name': 'এজেন্টের নাম',
    'perf.total_files': 'মোট ফাইল',
    'perf.visited_files': 'ভিজিট সম্পন্ন',
    'perf.collections_count': 'রসিদ সংখ্যা',
    'perf.total_collected': 'মোট আদায়কৃত টাকা',
    'perf.avg_collection': 'গড় আদায় / রসিদ',

    // Expiry Tracker
    'expiry.title': 'পোর্টফোলিও মেয়াদ ট্র্যাকিং ম্যাট্রিক্স',
    'expiry.subtitle': 'অংশীদার ব্যাংক এবং রিকভারি মেয়াদের সময়সীমা পর্যবেক্ষণ করুন',
    'expiry.expiring_7': '৭ দিনের মধ্যে মেয়াদোত্তীর্ণ',
    'expiry.expiring_30': '৩০ দিনের মধ্যে মেয়াদোত্তীর্ণ',
    'expiry.expired': 'মেয়াদোত্তীর্ণ ফাইল',
    'expiry.active': 'সক্রিয় পোর্টফোলিও',

    // Flagged Cases
    'legal.title': 'আইনি ও চিহ্নিত মামলা রেজিস্ট্রি',
    'legal.subtitle': 'আদালতের মামলা, প্রতিশ্রুতি ভঙ্গ, বিরোধ ও নিখোঁজ গ্রাহকের ফাইলসমূহ',
    'legal.all': 'সকল চিহ্নিত ফাইল',
    'legal.proceedings': 'আইনি কার্যক্রম',
    'legal.untraceable': 'নিখোঁজ / স্থানান্তরিত',
    'legal.broken': 'ভাঙ্গা প্রতিশ্রুতি (PTP)',
    'legal.disputed': 'বিতর্কিত একাউন্ট',

    // Team Management
    'team.title': 'টিম ও ইউজার ম্যানেজমেন্ট',
    'team.subtitle': 'ফিল্ড এজেন্ট ও রিকভারি ম্যানেজার তৈরি, সম্পাদনা, পদবি নির্ধারণ ও পরিচালনা',
    'team.add_user': 'নতুন ইউজার / এজেন্ট যোগ করুন',
    'team.perms_btn': 'ভূমিকা ও অনুমতি নিয়ন্ত্রণ',
    'team.search': 'নাম, ইমেইল বা আইডি দিয়ে খুঁজুন...',
    'team.all_roles': 'সকল পদবি',
    'team.role_admin': 'অ্যাডমিনিস্ট্রেটর',
    'team.role_manager': 'টিম ম্যানেজার',
    'team.role_agent': 'ফিল্ড এজেন্ট',
    'team.activate': 'সক্রিয় করুন',
    'team.deactivate': 'নিষ্ক্রিয় করুন',
    'team.edit': 'সম্পাদনা',
    'team.delete': 'মুছুন',
    'team.perms': 'অনুমতি',

    // Login
    'login.signin_title': 'রিকভারি এজেন্ট ও অফিসার পোর্টাল',
    'login.signin_subtitle': 'ঋণ ও বকেয়া আদায় পোর্টাল ব্যবহারে আপনার প্রাতিষ্ঠানিক একাউন্টে প্রবেশ করুন',
    'login.email': 'ইমেইল ঠিকানা',
    'login.password': 'পাসওয়ার্ড',
    'login.remember': 'ডিভাইস মনে রাখুন',
    'login.submit': 'ড্যাশবোর্ডে প্রবেশ করুন',
    'login.demo_personas': '১-ক্লিক ডেমো একাউন্ট',
    'login.demo_ready': 'ডেমো প্রস্তুত',
  }
};

// ═══════════════════════════════════════════════════════════════════════
// Global auto-translation engine (English → Bengali)
// Translates ALL rendered text — including hardcoded strings — whenever
// Bengali mode is active. Multi-word phrases first, then word-by-word.
// ═══════════════════════════════════════════════════════════════════════

// Multi-word phrases (case-insensitive exact match of the whole trimmed node)
export const BN_PHRASES: Record<string, string> = {
  // App / nav / generic headers
  'workhub (hr)': 'ওয়ার্কহাব (এইচআর)',
  'workhub': 'ওয়ার্কহাব',
  'workhub — hr & operations': 'ওয়ার্কহাব — এইচআর ও অপারেশনস',
  'hr & operations': 'এইচআর ও অপারেশনস',
  'daily file upload': 'ডেইলি ফাইল আপলোড',
  'official upload format': 'অফিসিয়াল আপলোড ফরম্যাট',
  "drop today's excel file here": 'আজকের এক্সেল ফাইল এখানে ড্রপ করুন',
  'reading file…': 'ফাইল পড়া হচ্ছে…',
  'reading file...': 'ফাইল পড়া হচ্ছে...',
  'rows in file': 'ফাইলের সারি',
  'duplicates': 'ডুপ্লিকেট',
  'discard': 'বাতিল করুন',
  'how it works': 'যেভাবে কাজ করে',
  'admin only': 'শুধুমাত্র অ্যাডমিন',
  'upload failed': 'আপলোড ব্যর্থ হয়েছে',
  'upload excel': 'এক্সেল আপলোড',
  'cases format': 'কেস ফরম্যাট',
  'contacts format': 'পরিচিতি ফরম্যাট',
  'preview — check the numbers before applying. nothing is changed yet.': 'প্রিভিউ — প্রয়োগ করার আগে সংখ্যাগুলো দেখে নিন। এখনও কিছু পরিবর্তন হয়নি।',
  'replace with': 'দিয়ে প্রতিস্থাপন করুন',
  'active files': 'সক্রিয় ফাইল',
  'replacing database…': 'ডাটাবেস প্রতিস্থাপন হচ্ছে…',
  'replacing database...': 'ডাটাবেস প্রতিস্থাপন হচ্ছে...',
  'quick actions': 'কুইক অ্যাকশন',
  'new case': 'নতুন ফাইল',
  'agent map': 'এজেন্ট ম্যাপ',
  'bank contacts': 'ব্যাংক পরিচিতি',
  'file export': 'ফাইল এক্সপোর্ট',
  'file update export': 'ফাইল আপডেট এক্সপোর্ট',
  'file update format & custom export': 'ফাইল আপডেট ফরম্যাট ও কাস্টম এক্সপোর্ট',
  'export restricted': 'এক্সপোর্ট সীমিত',
  'export excel': 'এক্সেল এক্সপোর্ট',
  'export pdf report': 'পিডিএফ রিপোর্ট এক্সপোর্ট',
  'total cash collected': 'মোট সংগৃহীত নগদ টাকা',
  'device logins & activity': 'ডিভাইস লগইন ও অ্যাক্টিভিটি',
  'unregistered agents': 'নিবন্ধিত নয় এমন এজেন্ট',
  'unregistered agents found': 'নিবন্ধিত নয় এমন এজেন্ট পাওয়া গেছে',
  'create agent accounts →': 'এজেন্ট একাউন্ট তৈরি করুন →',
  'pending': 'অপেক্ষমাণ',
  // Map page
  'my location': 'আমার অবস্থান',
  'refresh telemetry': 'টেলিমেট্রি রিফ্রেশ',
  '24/7 trail': '২৪/৭ ট্রেইল',
  'personnel directory': 'কর্মী তালিকা',
  'all staff': 'সকল কর্মী',
  'managers': 'ম্যানেজারগণ',
  'agents': 'এজেন্টগণ',
  'admins': 'অ্যাডমিনগণ',
  'map legend': 'ম্যাপ লিজেন্ড',
  'assigned agent': 'নিয়োজিত এজেন্ট',
  'you': 'আপনি',
  'search agent name, phone, id...': 'এজেন্টের নাম, ফোন, আইডি দিয়ে খুঁজুন...',
  'real-time gps': 'রিয়েল-টাইম জিপিএস',
  'live personnel & field telemetry': 'লাইভ কর্মী ও ফিল্ড টেলিমেট্রি',
  'live agent map': 'লাইভ এজেন্ট ম্যাপ',
  'no staff members found': 'কোনো কর্মী পাওয়া যায়নি',
  'add agents in team management.': 'টিম ম্যানেজমেন্টে এজেন্ট যোগ করুন।',
  'no agents assigned to you yet': 'এখনও আপনার অধীনে কোনো এজেন্ট নেই',
  // Contacts page
  'add bank officer': 'ব্যাংক কর্মকর্তা যোগ করুন',
  'add officer contact': 'কর্মকর্তার পরিচিতি সংরক্ষণ',
  'save officer contact': 'কর্মকর্তার পরিচিতি সংরক্ষণ করুন',
  'edit bank officer': 'ব্যাংক কর্মকর্তা সম্পাদনা',
  'no phone number': 'ফোন নম্বর নেই',
  'call': 'কল',
  'no bank contacts found': 'কোনো ব্যাংক পরিচিতি পাওয়া যায়নি',
  'add a new contact using the button above': 'উপরের বাটন দিয়ে নতুন পরিচিতি যোগ করুন',
  'partner bank': 'অংশীদার ব্যাংক',
  'officer full name': 'কর্মকর্তার পূর্ণ নাম',
  'designation': 'পদবি',
  'department': 'বিভাগ',
  'phone number': 'ফোন নম্বর',
  'email address': 'ইমেইল ঠিকানা',
  'branch / location': 'শাখা / অবস্থান',
  'importing…': 'ইমপোর্ট হচ্ছে…',
  'importing...': 'ইমপোর্ট হচ্ছে...',
  // WorkHub modules
  'payroll': 'পে-রোল',
  'attendance': 'হাজিরা',
  'hiring': 'নিয়োগ',
  'growth': 'গ্রোথ',
  'people': 'পিপল',
  'inventory': 'ইনভেন্টরি',
  'leave': 'ছুটি',
  'reports': 'রিপোর্ট',
  'add payroll': 'পে-রোল যোগ করুন',
  'add attendance': 'হাজিরা যোগ করুন',
  'add hiring': 'নিয়োগ যোগ করুন',
  'add growth': 'গ্রোথ যোগ করুন',
  'add people': 'পিপল যোগ করুন',
  'add inventory': 'ইনভেন্টরি যোগ করুন',
  'add leave': 'ছুটি যোগ করুন',
  'add record': 'রেকর্ড যোগ করুন',
  'save changes': 'পরিবর্তন সংরক্ষণ করুন',
  'download excel (all modules)': 'এক্সেল ডাউনলোড (সব মডিউল)',
  'download pdf (all modules)': 'পিডিএফ ডাউনলোড (সব মডিউল)',
  'select…': 'নির্বাচন করুন…',
  'select employee…': 'কর্মী নির্বাচন করুন…',
  'is required': 'আবশ্যক',
  'no records yet': 'এখনও কোনো রেকর্ড নেই',
  'actions': 'পদক্ষেপ',
  // Team management
  'team management': 'টিম ম্যানেজমেন্ট',
  'add new user / agent': 'নতুন ইউজার / এজেন্ট যোগ করুন',
  'roles & permissions control': 'ভূমিকা ও অনুমতি নিয়ন্ত্রণ',
  'all roles': 'সকল পদবি',
  'administrator': 'অ্যাডমিনিস্ট্রেটর',
  'team manager': 'টিম ম্যানেজার',
  'field agent': 'ফিল্ড এজেন্ট',
  'activate': 'সক্রিয় করুন',
  'deactivate': 'নিষ্ক্রিয় করুন',
  'edit': 'সম্পাদনা',
  'delete': 'মুছুন',
  'perms': 'অনুমতি',
  'sign out': 'লগআউট',
  // Common words
  'save': 'সংরক্ষণ',
  'cancel': 'বাতিল',
  'search': 'খুঁজুন',
  'total': 'মোট',
  'amount': 'পরিমাণ',
  'date': 'তারিখ',
  'phone': 'ফোন',
  'email': 'ইমেইল',
  'name': 'নাম',
  'notes': 'নোট',
  'branch': 'শাখা',
  'bank': 'ব্যাংক',
  'customer': 'গ্রাহক',
  'file': 'ফাইল',
  'files': 'ফাইল',
  'status': 'অবস্থা',
  'active': 'সক্রিয়',
  'inactive': 'নিষ্ক্রিয়',
  'admin': 'অ্যাডমিন',
  'manager': 'ম্যানেজার',
  'agent': 'এজেন্ট',
  'approved': 'অনুমোদিত',
  'rejected': 'প্রত্যাখ্যাত',
  'paid': 'পরিশোধিত',
  'present': 'উপস্থিত',
  'absent': 'অনুপস্থিত',
  'late': 'দেরি',
  'download': 'ডাউনলোড',
  'view file': 'ফাইল দেখুন',
  'open': 'খুলুন',
  'close': 'বন্ধ করুন',
  'add': 'যোগ করুন',
  'today': 'আজ',
  'visit notes': 'ভিজিট নোট',
  'dashboard': 'ড্যাশবোর্ড',
};

// Word-by-word fallback dictionary
export const BN_WORDS: Record<string, string> = {
  'dashboard': 'ড্যাশবোর্ড', 'files': 'ফাইল', 'file': 'ফাইল', 'total': 'মোট',
  'collected': 'আদায়কৃত', 'outstanding': 'বকেয়া', 'overdue': 'মেয়াদোত্তীর্ণ',
  'status': 'অবস্থা', 'active': 'সক্রিয়', 'inactive': 'নিষ্ক্রিয়', 'online': 'অনলাইন',
  'offline': 'অফলাইন', 'agent': 'এজেন্ট', 'agents': 'এজেন্ট', 'manager': 'ম্যানেজার',
  'managers': 'ম্যানেজার', 'admin': 'অ্যাডমিন', 'admins': 'অ্যাডমিন', 'customer': 'গ্রাহক',
  'bank': 'ব্যাংক', 'banks': 'ব্যাংক', 'branch': 'শাখা', 'area': 'এলাকা',
  'phone': 'ফোন', 'email': 'ইমেইল', 'name': 'নাম', 'date': 'তারিখ', 'amount': 'পরিমাণ',
  'amounts': 'পরিমাণ', 'notes': 'নোট', 'note': 'নোট', 'search': 'খুঁজুন', 'save': 'সংরক্ষণ',
  'cancel': 'বাতিল', 'edit': 'সম্পাদনা', 'delete': 'মুছুন', 'add': 'যোগ করুন',
  'actions': 'পদক্ষেপ', 'action': 'পদক্ষেপ', 'close': 'বন্ধ', 'open': 'খোলা',
  'download': 'ডাউনলোড', 'upload': 'আপলোড', 'export': 'এক্সপোর্ট', 'import': 'ইমপোর্ট',
  'view': 'দেখুন', 'show': 'দেখান', 'visited': 'ভিজিট হয়েছে', 'visit': 'ভিজিট',
  'pending': 'অপেক্ষমাণ', 'approved': 'অনুমোদিত', 'rejected': 'প্রত্যাখ্যাত',
  'paid': 'পরিশোধিত', 'present': 'উপস্থিত', 'absent': 'অনুপস্থিত', 'late': 'দেরি',
  'leave': 'ছুটি', 'cash': 'নগদ', 'payment': 'পেমেন্ট', 'payments': 'পেমেন্ট',
  'promise': 'প্রতিশ্রুতি', 'promises': 'প্রতিশ্রুতি', 'today': 'আজ', 'yesterday': 'গতকাল',
  'tomorrow': 'আগামীকাল', 'cases': 'ফাইল', 'case': 'ফাইল', 'recoveries': 'আদায়',
  'recovery': 'রিকভারি', 'report': 'রিপোর্ট', 'reports': 'রিপোর্ট', 'team': 'টিম',
  'user': 'ইউজার', 'users': 'ইউজার', 'staff': 'কর্মী', 'salary': 'বেতন', 'basic': 'মূল বেতন',
  'employee': 'কর্মী', 'employees': 'কর্মী', 'candidate': 'প্রার্থী', 'interview': 'সাক্ষাৎকার',
  'item': 'আইটেম', 'quantity': 'পরিমাণ', 'condition': 'অবস্থা', 'target': 'লক্ষ্য',
  'achieved': 'অর্জিত', 'rating': 'রেটিং', 'rank': 'র‍্যাংক', 'receipt': 'রসিদ',
  'receipts': 'রসিদ', 'precision': 'নির্ভুলতা', 'expired': 'মেয়াদোত্তীর্ণ', 'expiring': 'মেয়াদ শেষ হচ্ছে',
  'legal': 'আইনি', 'disputed': 'বিতর্কিত', 'untraceable': 'অচিহ্নিত', 'settled': 'নিষ্পত্তি',
  'new': 'নতুন', 'progress': 'চলমান', 'summary': 'সারসংক্ষেপ', 'details': 'বিস্তারিত',
  'detail': 'বিস্তারিত', 'address': 'ঠিকানা', 'type': 'ধরন', 'from': 'থেকে', 'to': 'পর্যন্ত',
  'all': 'সকল', 'and': 'ও', 'or': 'অথবা', 'of': 'এর', 'in': 'মধ্যে', 'on': 'উপর',
  'the': '', 'a': '', 'is': 'হলো', 'are': 'হলো', 'no': 'কোনো নেই', 'none': 'কিছু নেই',
  'not': 'নয়', 'with': 'সহ', 'for': 'জন্য', 'by': 'দ্বারা', 'at': 'তে', 'this': 'এই',
  'my': 'আমার', 'your': 'আপনার', 'me': 'আমি', 'you': 'আপনি', 'records': 'রেকর্ড',
  'record': 'রেকর্ড', 'found': 'পাওয়া গেছে', 'loading': 'লোড হচ্ছে', 'success': 'সফল',
  'failed': 'ব্যর্থ', 'error': 'ত্রুটি', 'warning': 'সতর্কতা', 'required': 'আবশ্যক',
  'select': 'নির্বাচন', 'choose': 'বেছে নিন', 'month': 'মাস', 'year': 'বছর', 'day': 'দিন',
  'days': 'দিন', 'time': 'সময়', 'check-in': 'চেক-ইন', 'check-out': 'চেক-আউট',
};

const hasAsciiLetters = (s: string): boolean => /[A-Za-z]/.test(s);
const hasBengali = (s: string): boolean => /[\u0980-\u09FF]/.test(s);

/** Translate one text string: exact phrases first, then word-by-word. */
export function translateToBengali(text: string): string {
  if (!text || !hasAsciiLetters(text) || hasBengali(text)) return text;

  // Preserve leading/trailing whitespace
  const lead = text.match(/^\s*/)?.[0] || '';
  const trail = text.match(/\s*$/)?.[0] || '';
  const core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;

  // 1) Whole-string phrase match (case-insensitive)
  const phrase = BN_PHRASES[core.toLowerCase()];
  if (phrase !== undefined) return lead + phrase + trail;

  // 2) Never touch data-looking strings (emails, file numbers, IDs, phones, amounts, URLs)
  if (/^[\d\s.,:+\-()#@\/&%-]+$/.test(core)) return text;
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(core)) return text;

  // 3) Word-by-word replacement
  let replaced = 0;
  const out = core.replace(/[A-Za-z][A-Za-z&\/'-]*/g, (word) => {
    const lower = word.toLowerCase();
    const hit = BN_PHRASES[lower] ?? BN_WORDS[lower];
    if (hit === undefined) return word;
    replaced++;
    // Preserve original capitalization for Bengali? Bengali has no case — just return.
    return hit;
  });
  if (replaced === 0) return text; // nothing translatable — keep original
  return lead + out + trail;
}

// ═══════════════════════════════════════════════════════════════════════
// DOM walker + MutationObserver
// ═══════════════════════════════════════════════════════════════════════

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);

function walkAndTranslate(root: Element | Document): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);

  for (const node of nodes) {
    const original = node.nodeValue || '';
    const translated = translateToBengali(original);
    if (translated !== original) node.nodeValue = translated;
  }

  // Placeholders + titles
  const attrEls = root.querySelectorAll?.('[placeholder], [title]');
  attrEls?.forEach(el => {
    const ph = el.getAttribute('placeholder');
    if (ph) {
      const t = translateToBengali(ph);
      if (t !== ph) el.setAttribute('placeholder', t);
    }
    const ti = el.getAttribute('title');
    if (ti) {
      const t = translateToBengali(ti);
      if (t !== ti) el.setAttribute('title', t);
    }
  });
}

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultText?: string) => string;
  trans: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('recovery_app_language');
    if (saved === 'bn' || saved === 'en') return saved;
    return 'en';
  });

  const translatingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const pendingRoots = useRef<Set<Element> | null>(null);

  useEffect(() => {
    localStorage.setItem('recovery_app_language', language);
    document.documentElement.lang = language;
  }, [language]);

  // ── Global DOM auto-translation while in Bengali mode ────────────────
  useEffect(() => {
    if (language !== 'bn') return;

    // Initial pass after paint
    const raf = requestAnimationFrame(() => {
      translatingRef.current = true;
      try { walkAndTranslate(document); } finally { translatingRef.current = false; }
    });

    const runSoon = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (translatingRef.current) return;
        const roots = pendingRoots.current;
        pendingRoots.current = null;
        if (!roots || roots.size === 0) return;
        translatingRef.current = true;
        try {
          // Translate only the changed subtrees; a full-document pass runs at
          // most once per minute as a self-healing sweep.
          roots.forEach(root => walkAndTranslate(root));
        } finally {
          translatingRef.current = false;
        }
      }, 120);
    };

    // Periodic safety sweep so anything missed by the incremental passes
    // (e.g. text changed while a translation was in flight) still converts.
    const sweepTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || translatingRef.current) return;
      translatingRef.current = true;
      try { walkAndTranslate(document); } finally { translatingRef.current = false;
      }
    }, 60_000);

    // Re-translate whenever React renders new/updated content — but only the
    // nodes that actually changed, and only when the tab is idle. Walking the
    // whole document on every keystroke made the app feel sluggish.
    const observer = new MutationObserver((mutations) => {
      if (translatingRef.current) return;
      // Collect the unique element roots that contain changed text
      const roots = new Set<Element>();
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(n => {
            if (n.nodeType === Node.ELEMENT_NODE) roots.add(n as Element);
            else if (n.parentElement) roots.add(n.parentElement);
          });
        } else if (m.type === 'characterData' && m.target.parentElement) {
          roots.add(m.target.parentElement);
        }
      }
      if (roots.size === 0) return;
      pendingRoots.current = roots;
      runSoon();
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.clearInterval(sweepTimer);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [language]);

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'en' ? 'bn' : 'en'));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, defaultText?: string): string => {
    const langDict = TRANSLATIONS[language];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    const fallback = TRANSLATIONS.en[key];
    if (fallback) return language === 'bn' ? translateToBengali(fallback) : fallback;
    return defaultText || key;
  };

  const trans = (text: string): string => {
    if (language === 'en' || !text) return text;
    return translateToBengali(text);
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t, trans }}>
      {/* Keyed wrapper: remounts the whole UI when language changes so
          DOM-auto-translated Bengali text resets to clean English on switch-back */}
      <LanguageRemountKey key={language}>{children}</LanguageRemountKey>
    </LanguageContext.Provider>
  );
};

/** Invisible wrapper whose only job is a stable key for remounting. */
const LanguageRemountKey: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
