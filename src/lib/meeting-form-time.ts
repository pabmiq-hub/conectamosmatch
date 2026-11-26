type Slot = { iso: string; free: boolean };

/** Both slot controls write the same ISO; never downgrade a chosen slot to a draft. */
export function resolveMeetingFormTime(slotIso: string, manualTime: string, slots: Slot[] | null): string | null {
  if (slotIso) {
    if (!slots) throw new Error("Espera a que se compruebe la disponibilidad del slot");
    const slot = slots.find((s) => s.iso === slotIso);
    if (!slot?.free) throw new Error("El slot elegido no está disponible; elige otro horario");
    return slot.iso;
  }
  if (!manualTime) return null;
  const date = new Date(manualTime);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha y hora no son válidas");
  return date.toISOString();
}