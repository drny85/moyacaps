const TARGET = 4 / 5;

/** Size of the centred 4:5 cover crop, as percentages of an image's natural size. */
export function cropFrame(naturalW: number, naturalH: number): { widthPct: number; heightPct: number } {
  const aspect = naturalW / naturalH;
  return aspect > TARGET
    ? { widthPct: (TARGET / aspect) * 100, heightPct: 100 }
    : { widthPct: 100, heightPct: (aspect / TARGET) * 100 };
}
