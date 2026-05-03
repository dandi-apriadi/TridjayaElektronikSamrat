import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIPreferenceState {
  isSidebarOpen: boolean;
  collapsedSections: Record<string, boolean>;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSectionCollapsed: (section: string, collapsed: boolean) => void;
  toggleSection: (section: string) => void;
}

/**
 * Store untuk menyimpan preferensi UI yang persisten
 * seperti state sidebar dan section yang di-collapse.
 */
export const useUIPreferenceStore = create<UIPreferenceState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      collapsedSections: {},
      
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      
      toggleSidebar: () => set((state) => ({ 
        isSidebarOpen: !state.isSidebarOpen 
      })),
      
      setSectionCollapsed: (section, collapsed) => 
        set((state) => ({ 
          collapsedSections: { 
            ...state.collapsedSections, 
            [section]: collapsed 
          } 
        })),
        
      toggleSection: (section) => 
        set((state) => ({ 
          collapsedSections: { 
            ...state.collapsedSections, 
            [section]: state.collapsedSections[section] === undefined ? false : !state.collapsedSections[section] 
          } 
        })),
    }),
    {
      name: 'tridjaya-ui-prefs',
    }
  )
);
