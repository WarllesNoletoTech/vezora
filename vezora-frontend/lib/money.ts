/** Le preco em formato brasileiro ou decimal simples (39,90 / 39.90 / 1.234,56).
 * Retorna centavos exatos ou null para entradas invalidas.
 */
export function parseBrlCents(input:string):number|null {
  const raw=input.trim();
  if(!/^\d[\d.,]*$/.test(raw))return null;
  const index=Math.max(raw.lastIndexOf('.'),raw.lastIndexOf(','));
  const decimal=index>=0?raw.slice(index+1):'';
  const hasCents=index>=0 && decimal.length>=1 && decimal.length<=2;
  const integerPart=(hasCents?raw.slice(0,index):raw).replace(/[.,]/g,'');
  if(!/^\d+$/.test(integerPart) || (hasCents&&!/^\d{1,2}$/.test(decimal)))return null;
  const cents=Number(integerPart)*100+(hasCents?Number(decimal.padEnd(2,'0')):0);
  if(!Number.isSafeInteger(cents)||cents<0||cents>500000)return null;
  return cents;
}
