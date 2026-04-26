import { create } from 'zustand';

interface CartStore {
  quantities: Record<string, number>;
  setQuantities: (quantities: Record<string, number>) => void;
  updateQuantity: (productId: string, delta: number, availableStock: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  quantities: {},
  setQuantities: (quantities) => set({ quantities }),
  updateQuantity: (productId, delta, availableStock) => set((state) => {
    const newQuantities = { ...state.quantities };
    const currentQuantity = newQuantities[productId] || 0;
    const newQuantity = Math.max(0, Math.min(currentQuantity + delta, availableStock));

    if (newQuantity > 0) {
      newQuantities[productId] = newQuantity;
    } else {
      delete newQuantities[productId];
    }

    return { quantities: newQuantities };
  }),
  clearCart: () => set({ quantities: {} }),
}));
