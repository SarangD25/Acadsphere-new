import { createClient } from '@supabase/supabase-js';

// Initialize live Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface StudentUser {
  id: string;
  fullName: string;
  college: string;
  course?: string;
  year: string;
  email: string;
  onboardingCompleted: boolean;
}

export interface TimetableEntry {
  id: string;
  userId: string;
  subject: string;
  faculty: string;
  room: string;
  day: string;
  startTime: string;
  endTime: string;
  color: string;
}

export interface AttendanceEntry {
  id: string;
  userId: string;
  subject: string;
  attended: number;
  total: number;
}

export interface CGPASubject {
  id: string;
  userId: string;
  semester: number;
  subjectName: string;
  credits: number;
  grade: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'F';
}

export interface MarksPrediction {
  id: string;
  userId: string;
  subject: string;
  internalScore: number;
  internalTotal: number;
  externalTotal: number;
  targetGrade: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C';
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'exam' | 'deadline' | 'reminder' | 'holiday';
}

export interface FeedbackSubmission {
  id: string;
  userId: string;
  message: string;
  rating: number; // 1-5
  date: string;
}

export interface BlogEntry {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  content_type: 'text' | 'html';
  cover_image?: string;
  status: 'draft' | 'published';
  author_id?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  is_always_running?: boolean;
  expiry_date?: string;
}

export interface HackathonEvent {
  id: string;
  title: string;
  organizer: string;
  date: string;
  type: 'hackathon' | 'ideathon' | 'workshop' | 'competition';
  description: string;
  image: string;
  applyLink?: string;
  deadlineDate?: string;
}

export interface InternshipListing {
  id: string;
  company: string;
  role: string;
  stipend: string;
  eligibility: string;
  duration: string;
  logo: string;
  applyLink?: string;
  deadlineDate?: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  type: 'Notes' | 'PDF' | 'PYQ' | 'Book';
  subject: string;
  semester: string;
  size: string;
  downloadUrl: string;
}

export interface UnauthenticatedCheck {
  id: string;
  feature: string;
  blog_slug?: string;
  created_at: string;
}

// Helper database persistence functions
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (_error: unknown) {
    return defaultValue;
  }
};

const setStorageItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_error) {}
};

// ----------------------------------------------------
// HYBRID DATABASE CONTROLLER WITH SUPABASE BACKEND
// ----------------------------------------------------
export const db = {
  // Analytics
  recordUnauthenticatedCheck: async (feature: string, blogSlug?: string): Promise<void> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // DO NOT track fully authenticated users
      if (session?.user && session.user.role === 'authenticated') return;
      
      // Lightweight protection against obvious duplicate/spam fires in the same session
      const sessionKey = `acadsphere_tracked_${feature}_${blogSlug || 'none'}`;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, 'true');
      }

      const payload = {
        feature,
        blog_slug: blogSlug,
      };

      const { error } = await supabase.from('unauthenticated_checks').insert([payload]);
      
      if (error) {
        console.error("Supabase INSERT failed for unauthenticated_checks:", error.message, error.details, error.hint);
        // We do NOT use localStorage as a fallback here because it would create isolated
        // fake data on the audience port that the admin portal (on a different port) could never read.
        return;
      }

    } catch (e) {
      console.error("Analytics recording encountered an exception:", e);
    }
  },

  // Sync all user profile data from Supabase
  syncUserData: async (userId: string): Promise<void> => {
    try {
      const [
        { data: tt },
        { data: att },
        { data: cg },
        { data: pred },
        { data: cal },
        { data: hol }
      ] = await Promise.all([
        supabase.from('timetable').select('*').eq('user_id', userId),
        supabase.from('attendance').select('*').eq('user_id', userId),
        supabase.from('cgpa').select('*').eq('user_id', userId),
        supabase.from('predictor').select('*').eq('user_id', userId),
        supabase.from('calendar').select('*').eq('user_id', userId),
        supabase.from('holidays').select('*')
      ]);

      // 1. Timetable
      if (tt) setStorageItem('acadsphere_timetable', tt.map(item => ({
        id: item.id,
        userId: item.user_id,
        subject: item.subject,
        faculty: item.faculty,
        room: item.room,
        day: item.day,
        startTime: item.start_time,
        endTime: item.end_time,
        color: item.color
      })));

      // 2. Attendance
      if (att) setStorageItem('acadsphere_attendance', att.map(item => ({
        id: item.id,
        userId: item.user_id,
        subject: item.subject,
        attended: item.attended,
        total: item.total
      })));

      // 3. CGPA
      if (cg) setStorageItem('acadsphere_cgpa', cg.map(item => ({
        id: item.id,
        userId: item.user_id,
        semester: item.semester,
        subjectName: item.subject_name,
        credits: item.credits,
        grade: item.grade
      })));

      // 4. Marks Predictor
      if (pred) setStorageItem('acadsphere_predictions', pred.map(item => ({
        id: item.id,
        userId: item.user_id,
        subject: item.subject,
        internalScore: Number(item.internal_score),
        internalTotal: Number(item.internal_total),
        externalTotal: Number(item.external_total),
        targetGrade: item.target_grade
      })));

      // 5. Custom Events
      if (cal) setStorageItem('acadsphere_calendar', cal.map(item => ({
        id: item.id,
        userId: item.user_id,
        title: item.title,
        date: item.date,
        type: item.type
      })));

      // 6. Global Holidays & Calendar Sync (Real-Time Admin Sync)
      if (hol) setStorageItem('acadsphere_holidays', hol.map(item => ({
        id: item.id,
        userId: 'admin',
        title: item.title,
        date: item.date,
        type: item.type
      })));

    } catch (_e: unknown) {
      console.warn('Supabase profile synchronizer failed. Falling back to local cache.');
    }
  },

  // --- Timetable API ---
  getTimetable: (userId: string): TimetableEntry[] => {
    return getStorageItem<TimetableEntry[]>('acadsphere_timetable', []).filter(e => e.userId === userId);
  },
  
  saveTimetableEntry: (entry: Omit<TimetableEntry, 'id'> & { id?: string }): TimetableEntry => {
    const entries = getStorageItem<TimetableEntry[]>('acadsphere_timetable', []);
    const newEntry: TimetableEntry = {
      ...entry,
      id: entry.id || 'tt-' + Math.random().toString(36).substr(2, 9)
    };
    if (newEntry.userId === 'guest') return newEntry;
    
    const index = entries.findIndex(e => e.id === newEntry.id);
    if (index >= 0) {
      entries[index] = newEntry;
    } else {
      entries.push(newEntry);
    }
    
    setStorageItem('acadsphere_timetable', entries);

    // Sync in background to Supabase
    supabase.from('timetable').upsert({
      id: newEntry.id.startsWith('tt-') ? undefined : newEntry.id, // let Postgres generate UUID if mock ID
      user_id: newEntry.userId,
      subject: newEntry.subject,
      faculty: newEntry.faculty,
      room: newEntry.room,
      day: newEntry.day,
      start_time: newEntry.startTime,
      end_time: newEntry.endTime,
      color: newEntry.color
    }).then();

    return newEntry;
  },

  deleteTimetableEntry: (id: string): void => {
    if (id.startsWith('tt-guest-') || id === 'guest') return; // Just in case, though guests don't trigger this normally
    const entries = getStorageItem<TimetableEntry[]>('acadsphere_timetable', []);
    setStorageItem('acadsphere_timetable', entries.filter(e => e.id !== id));

    // Sync deletion in background
    supabase.from('timetable').delete().eq('id', id).then();
  },

  clearAllTimetable: (userId: string): void => {
    const entries = getStorageItem<TimetableEntry[]>('acadsphere_timetable', []);
    setStorageItem('acadsphere_timetable', entries.filter(e => e.userId !== userId));
    supabase.from('timetable').delete().eq('user_id', userId).then();
  },

  // --- Attendance API ---
  getAttendance: (userId: string): AttendanceEntry[] => {
    const entries = getStorageItem<AttendanceEntry[]>('acadsphere_attendance', []);
    return entries.filter(e => e.userId === userId);
  },

  saveAttendance: (entry: Omit<AttendanceEntry, 'id'> & { id?: string }): AttendanceEntry => {
    const entries = getStorageItem<AttendanceEntry[]>('acadsphere_attendance', []);
    const newEntry: AttendanceEntry = {
      ...entry,
      id: entry.id || 'att-' + Math.random().toString(36).substr(2, 9)
    };
    if (newEntry.userId === 'guest') return newEntry;

    const index = entries.findIndex(e => e.id === newEntry.id);
    if (index >= 0) {
      entries[index] = newEntry;
    } else {
      entries.push(newEntry);
    }

    setStorageItem('acadsphere_attendance', entries);

    // Sync in background
    supabase.from('attendance').upsert({
      id: newEntry.id.startsWith('att-') ? undefined : newEntry.id,
      user_id: newEntry.userId,
      subject: newEntry.subject,
      attended: newEntry.attended,
      total: newEntry.total
    }).then();

    return newEntry;
  },

  deleteAttendance: (id: string): void => {
    if (id.startsWith('att-guest-') || id === 'guest') return;
    const entries = getStorageItem<AttendanceEntry[]>('acadsphere_attendance', []);
    setStorageItem('acadsphere_attendance', entries.filter(e => e.id !== id));

    supabase.from('attendance').delete().eq('id', id).then();
  },

  // --- CGPA API ---
  getCGPASubjects: (userId: string): CGPASubject[] => {
    const subjects = getStorageItem<CGPASubject[]>('acadsphere_cgpa', []);
    return subjects.filter(s => s.userId === userId);
  },

  saveCGPASubject: (subject: Omit<CGPASubject, 'id'> & { id?: string }): CGPASubject => {
    const subjects = getStorageItem<CGPASubject[]>('acadsphere_cgpa', []);
    const newSubject: CGPASubject = {
      ...subject,
      id: subject.id || 'cg-' + Math.random().toString(36).substr(2, 9)
    };
    if (newSubject.userId === 'guest') return newSubject;

    const index = subjects.findIndex(s => s.id === newSubject.id);
    if (index >= 0) {
      subjects[index] = newSubject;
    } else {
      subjects.push(newSubject);
    }

    setStorageItem('acadsphere_cgpa', subjects);

    supabase.from('cgpa').upsert({
      id: newSubject.id.startsWith('cg-') ? undefined : newSubject.id,
      user_id: newSubject.userId,
      semester: newSubject.semester,
      subject_name: newSubject.subjectName,
      credits: newSubject.credits,
      grade: newSubject.grade
    }).then();

    return newSubject;
  },

  deleteCGPASubject: (id: string): void => {
    if (id.startsWith('cg-guest-') || id === 'guest') return;
    const subjects = getStorageItem<CGPASubject[]>('acadsphere_cgpa', []);
    setStorageItem('acadsphere_cgpa', subjects.filter(s => s.id !== id));

    supabase.from('cgpa').delete().eq('id', id).then();
  },

  // --- Marks Predictor API ---
  getMarksPredictions: (userId: string): MarksPrediction[] => {
    const predictions = getStorageItem<MarksPrediction[]>('acadsphere_predictions', []);
    return predictions.filter(p => p.userId === userId);
  },

  saveMarksPrediction: (prediction: Omit<MarksPrediction, 'id'> & { id?: string }): MarksPrediction => {
    const predictions = getStorageItem<MarksPrediction[]>('acadsphere_predictions', []);
    const newPred: MarksPrediction = {
      ...prediction,
      id: prediction.id || 'pred-' + Math.random().toString(36).substr(2, 9)
    };
    if (newPred.userId === 'guest') return newPred;

    const index = predictions.findIndex(p => p.id === newPred.id);
    if (index >= 0) {
      predictions[index] = newPred;
    } else {
      predictions.push(newPred);
    }

    setStorageItem('acadsphere_predictions', predictions);

    supabase.from('predictor').upsert({
      id: newPred.id.startsWith('pred-') ? undefined : newPred.id,
      user_id: newPred.userId,
      subject: newPred.subject,
      internal_score: newPred.internalScore,
      internal_total: newPred.internalTotal,
      external_total: newPred.externalTotal,
      target_grade: newPred.targetGrade
    }).then();

    return newPred;
  },

  deleteMarksPrediction: (id: string): void => {
    if (id.startsWith('pred-guest-') || id === 'guest') return;
    const predictions = getStorageItem<MarksPrediction[]>('acadsphere_predictions', []);
    setStorageItem('acadsphere_predictions', predictions.filter(p => p.id !== id));

    supabase.from('predictor').delete().eq('id', id).then();
  },

  // --- Calendar Events API ---
  getCalendarEvents: (userId: string): CalendarEvent[] => {
    const events = getStorageItem<CalendarEvent[]>('acadsphere_calendar', []);
    const holidays = getStorageItem<CalendarEvent[]>('acadsphere_holidays', []);
    const filtered = events.filter(e => e.userId === userId);
    return [...filtered, ...holidays];
  },

  saveCalendarEvent: (event: Omit<CalendarEvent, 'id'> & { id?: string }): CalendarEvent => {
    const events = getStorageItem<CalendarEvent[]>('acadsphere_calendar', []);
    const newEvent: CalendarEvent = {
      ...event,
      id: event.id || 'cal-' + Math.random().toString(36).substr(2, 9)
    };
    if (newEvent.userId === 'guest') return newEvent;

    const index = events.findIndex(e => e.id === newEvent.id);
    if (index >= 0) {
      events[index] = newEvent;
    } else {
      events.push(newEvent);
    }

    setStorageItem('acadsphere_calendar', events);

    const isNew = newEvent.id.startsWith('cal-');
    if (isNew) {
      supabase.from('calendar').insert({
        user_id: newEvent.userId,
        title: newEvent.title,
        date: newEvent.date,
        type: newEvent.type
      }).then(res => {
        if (res.error) {
          
        }
      });
    } else {
      supabase.from('calendar').update({
        title: newEvent.title,
        date: newEvent.date,
        type: newEvent.type
      }).eq('id', newEvent.id).then(res => {
        if (res.error) return;
      });
    }

    return newEvent;
  },

  deleteCalendarEvent: (id: string): void => {
    if (id.startsWith('cal-guest-') || id === 'guest') return;
    const events = getStorageItem<CalendarEvent[]>('acadsphere_calendar', []);
    setStorageItem('acadsphere_calendar', events.filter(e => e.id !== id));

    supabase.from('calendar').delete().eq('id', id).then();
  },

  // --- Feedback API ---
  saveFeedback: (feedback: Omit<FeedbackSubmission, 'id' | 'date'>): FeedbackSubmission => {
    const submissions = getStorageItem<FeedbackSubmission[]>('acadsphere_feedback', []);
    const newSub: FeedbackSubmission = {
      ...feedback,
      id: 'fb-' + Math.random().toString(36).substr(2, 9),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    submissions.push(newSub);
    setStorageItem('acadsphere_feedback', submissions);

    supabase.from('feedback').insert({
      user_id: newSub.userId,
      message: newSub.message,
      rating: newSub.rating
    }).then();

    return newSub;
  },

  getFeedbackHistory: (userId: string): FeedbackSubmission[] => {
    return getStorageItem<FeedbackSubmission[]>('acadsphere_feedback', []).filter(s => s.userId === userId);
  },

  // ----------------------------------------------------
  // ECOSYSTEM LIVE SYNC GETTERS (FETCH FROM SUPABASE)
  // ----------------------------------------------------
  getEvents: async (): Promise<HackathonEvent[]> => {
    const { data, error } = await supabase.from('events').select('*');
    if (error || !data || data.length === 0) {
      return [
        { id: '1', title: 'National AI & Cloud Hackathon 2026', organizer: 'Tech Mahindra & IEEE', date: 'Aug 25 - Aug 27', type: 'competition', description: '36-hour continuous buildathon with prizes worth $10,000.', image: '', applyLink: '#' },
        { id: '2', title: 'Web3 & Decentralized Systems Bootcamp', organizer: 'DevFolio', date: 'Sep 05, 2026', type: 'workshop', description: 'Hands-on workshop building smart contracts and dApps.', image: '', applyLink: '#' }
      ];
    }
    return data.map(item => ({
      id: item.id,
      title: item.title,
      organizer: item.organizer || "",
      date: item.date || "",
      type: item.category === 'Competition/Event' ? 'competition' : 'workshop',
      description: item.description || "",
      image: item.image || "",
      applyLink: item.apply_link || "",
      deadlineDate: item.deadline_date || undefined
    }));
  },

  getInternships: async (): Promise<InternshipListing[]> => {
    const { data, error } = await supabase.from('internships').select('*');
    if (error || !data || data.length === 0) {
      return [
        { id: '1', company: 'Google Cloud', role: 'Software Engineering Intern', stipend: '$2,500 / mo', eligibility: 'Pre-final Year Students', duration: '3 Months', logo: 'G', applyLink: '#' },
        { id: '2', company: 'Microsoft', role: 'Data Science & AI Intern', stipend: '$2,200 / mo', eligibility: 'B.Tech / M.Tech CS/IT', duration: '6 Months', logo: 'M', applyLink: '#' },
        { id: '3', company: 'Amazon AWS', role: 'Cloud Infrastructure Intern', stipend: '$2,000 / mo', eligibility: 'Final Year Students', duration: '3 Months', logo: 'A', applyLink: '#' }
      ];
    }
    return data.map(item => ({
      id: item.id,
      company: item.company_name || "",
      role: item.title || "",
      stipend: item.stipend || "",
      eligibility: item.qualification || "",
      duration: item.duration || "",
      logo: item.company_name ? item.company_name[0].toUpperCase() : "",
      applyLink: item.apply_link || "",
      deadlineDate: item.deadline_date || undefined
    }));
  },

  getLibrary: async (): Promise<LibraryItem[]> => {
    const { data, error } = await supabase.from('e_library').select('*');
    if (error || !data || data.length === 0) {
      return [
        { id: '1', title: 'Data Structures & Algorithms Master Notes', type: 'Notes', subject: 'Computer Science', semester: 'Sem 3', size: '4.2 MB', downloadUrl: '#' },
        { id: '2', title: 'Operating Systems Previous Year Questions (2021-2024)', type: 'PYQ', subject: 'Computer Science', semester: 'Sem 4', size: '2.8 MB', downloadUrl: '#' },
        { id: '3', title: 'Digital Electronics & Logic Design E-Book', type: 'Book', subject: 'Electronics', semester: 'Sem 2', size: '15.6 MB', downloadUrl: '#' },
        { id: '4', title: 'Database Management Systems Cheatsheet & Diagram PDF', type: 'PDF', subject: 'Information Technology', semester: 'Sem 4', size: '1.4 MB', downloadUrl: '#' },
        { id: '5', title: 'Computer Networks - Complete Lecture Handouts', type: 'Notes', subject: 'Computer Science', semester: 'Sem 5', size: '6.1 MB', downloadUrl: '#' },
        { id: '6', title: 'Artificial Intelligence & Machine Learning Exam Prep', type: 'PYQ', subject: 'AI & Data Science', semester: 'Sem 6', size: '3.5 MB', downloadUrl: '#' }
      ];
    }
    return data.map(item => ({
      id: item.id,
      title: item.title,
      type: item.category === 'Notes' ? 'Notes' : item.category === 'PYQs' ? 'PYQ' : item.category === 'E-Books' ? 'Book' : 'PDF',
      subject: item.subject || "",
      semester: item.semester || "",
      size: item.size || "",
      downloadUrl: item.file_link || item.external_link || ""
    }));
  },

  isEmailBanned: async (email: string): Promise<boolean> => {
    try {
      const { data } = await supabase.from('banned_users').select('email').eq('email', email.toLowerCase()).single();
      return !!data;
    } catch (_e) {
      // In case of network error, check local storage as fallback
      const list = getStorageItem<string[]>('acadsphere_banned_users', []);
      return list.includes(email.toLowerCase());
    }
  },

  completeOnboarding: async (userId: string, college: string, course: string, year: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          college,
          course,
          year,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.warn('Failed to complete onboarding:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Exception completing onboarding:', e);
      return false;
    }
  },

  skipOnboarding: async (userId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.warn('Failed to skip onboarding:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Exception skipping onboarding:', e);
      return false;
    }
  },

  getBlogs: async (onRefresh?: (data: BlogEntry[]) => void): Promise<BlogEntry[]> => {
    try {
      const cached = getStorageItem<BlogEntry[]>('acadsphere_blogs', []);
      
      // Fetch in background to update cache
      const fetchPromise = supabase
        .from('blogs')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            const now = new Date();
            now.setHours(0,0,0,0);
            const validBlogs = data.filter(blog => {
              if (blog.is_always_running !== false) return true;
              if (!blog.expiry_date) return true;
              const expiry = new Date(blog.expiry_date);
              return now <= expiry;
            });
            setStorageItem('acadsphere_blogs', validBlogs);
            if (onRefresh) onRefresh(validBlogs);
            return validBlogs;
          }
          return null;
        });

      // Return immediately if cached
      if (cached && cached.length > 0) {
        // We don't await the fetchPromise to avoid blocking, but NextJS/React might want the latest data.
        // Returning cached data immediately gives instant UX.
        Promise.resolve(fetchPromise).catch(() => {}); 
        return cached;
      }

      // If no cache, await the fetch
      const result = await fetchPromise;
      return result || [];

    } catch (e) {
      console.warn("Failed to fetch blogs:", e);
      return getStorageItem<BlogEntry[]>('acadsphere_blogs', []);
    }
  },

  getBlogBySlug: async (slug: string): Promise<BlogEntry | null> => {
    try {
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
        
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn("Failed to fetch blog by slug:", e);
      return null;
    }
  }
};
