'use client';
export function PrintReceiptButton(){return <button type="button" onClick={()=>window.print()} className="orange-gradient rounded-xl px-5 py-3 font-black text-white print:hidden">Download / print PDF</button>}
