import {CalendarDays,Eye,Flower2,Footprints,Hand,Palette,Scissors,Sparkles,Waves} from 'lucide-react';
import {BusinessType,businessTheme} from '@/lib/business';
export default function BusinessMotif({type,large=false}:{type?:BusinessType|null;large?:boolean}){
  const theme=businessTheme(type);const size=large?92:52;
  const icons={scissors:Scissors,waves:Waves,sparkles:Sparkles,hand:Hand,eye:Eye,flower:Flower2,palette:Palette,footprints:Footprints,calendar:CalendarDays};
  const Icon=icons[theme.icon];
  return <div className={`business-motif ${large?'business-motif-large':''}`} aria-label={theme.label}>
    <span className="business-motif-orbit"/><span className="business-motif-orbit orbit-small"/>
    <Icon size={size} strokeWidth={1.45}/><small>{theme.label}</small>
  </div>;
}
