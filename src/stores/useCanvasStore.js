import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints < 256);

// Custom storage engine using IndexedDB
const idbStorage = {
  getItem: async (name) => {
    return (await idbGet(name)) || null;
  },
  setItem: async (name, value) => {
    await idbSet(name, value);
  },
  removeItem: async (name) => {
    await idbDel(name);
  },
};

export const useCanvasStore = create(
  persist(
    (set, getStore) => ({
      isMobile: isMobileDevice,
      forceMobileMode: () => set({ isMobile: true }),
      hasStartedMobile: false,
      setHasStartedMobile: (started) => set({ hasStartedMobile: started }),
      isMobileWalking: false,

      hasPlayedIntro: false,
      setHasPlayedIntro: (played) => set({ hasPlayedIntro: played }),

      // Pointer Lock State
      isLocked: false,
      setIsLocked: (locked) => set({ isLocked: locked }),

      // Request that gallery controls re-acquire pointer lock after closing the editor.
      shouldRelock: false,
      requestRelock: () => set({ shouldRelock: true }),
      clearRelockRequest: () => set({ shouldRelock: false }),

      // The active canvas we are currently editing (null if in gallery mode)
      activeCanvas: null,
      setActiveCanvas: (name) => set({ activeCanvas: name }),
      
      // A record of artworks: { [canvasName]: { imageData, title, artist, description } }
      paintings: {},
      savePainting: (name, artwork) => {
        set((state) => {
          const isNew = !state.paintings[name];
          return {
            paintings: { ...state.paintings, [name]: artwork },
            paintedCanvases: isNew ? state.paintedCanvases + 1 : state.paintedCanvases
          };
        });

        // Automatically archive temporary station artworks after 2 minutes
        if (name === 'station_1' || name === 'station_2') {
          setTimeout(() => {
            getStore().archiveArtwork(name);
          }, 120000);
        }
      },

      archiveArtwork: (stationName) => {
        set((state) => {
          const artwork = state.paintings[stationName];
          if (!artwork) return state;
          
          let chunk = 0;
          let targetCanvas = null;
          let found = false;

          // Scan endlessly forward to find first available canvas slot
          while (!found) {
            const slots = [`canvas_${chunk}_l0`, `canvas_${chunk}_r0`, `canvas_${chunk}_l1`, `canvas_${chunk}_r1`];
            for (const slot of slots) {
              if (!state.paintings[slot]) {
                targetCanvas = slot;
                found = true;
                break;
              }
            }
            chunk++;
          }

          if (targetCanvas) {
            const newPaintings = { ...state.paintings };
            newPaintings[targetCanvas] = artwork;
            delete newPaintings[stationName];
            return { paintings: newPaintings };
          }
          return state;
        });
      },

      teleportTarget: null,
      setTeleportTarget: (target) => set({ teleportTarget: target }),

      totalCanvases: 0,
      paintedCanvases: 0,
      setTotalCanvases: (count) => set({ totalCanvases: count }),
    }),
    {
      name: 'canvas-museum-storage',
      storage: createJSONStorage(() => idbStorage),
      // Only persist the artworks and total painted count
      partialize: (state) => ({ 
        paintings: state.paintings, 
        paintedCanvases: state.paintedCanvases 
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Instantly clear out any artworks left in creation stations when the app loads
          if (state.paintings['station_1']) state.archiveArtwork('station_1');
          if (state.paintings['station_2']) state.archiveArtwork('station_2');
        }
      }
    }
  )
);
