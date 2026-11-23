export default function EquipmentArt({ category, small = false }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return <svg className={small ? 'equipment-art small-art' : 'equipment-art'} viewBox="0 0 280 170" aria-hidden="true">
    <ellipse cx="140" cy="145" rx="74" ry="9" fill="currentColor" opacity=".09" />
    <g {...common}>
      {category === 'Cameras' && <>
        <path d="M77 69h24l11-18h44l10 18h34a10 10 0 0 1 10 10v51a10 10 0 0 1-10 10H77a10 10 0 0 1-10-10V79a10 10 0 0 1 10-10Z" fill="currentColor" fillOpacity=".09" />
        <circle cx="141" cy="103" r="28" fill="var(--art-bg, #e1ebe5)"/><circle cx="141" cy="103" r="18"/><path d="m133 94 13 18m-14-4 15-12" opacity=".3"/><path d="M176 84h15M79 82h15M82 61h17"/>
      </>}
      {category === 'Tools' && <>
        <path d="M76 55h81a9 9 0 0 1 9 9v35H77a12 12 0 0 1-12-12V67a12 12 0 0 1 11-12Z" fill="currentColor" fillOpacity=".1"/>
        <path d="M165 63h20v27h-20m20-19h28m-94 29-7 35H83l7-35m-12 36h47v11H78zM79 68h17m-17 10h17m-17 10h17"/>
      </>}
      {category === 'Outdoor' && <>
        <path d="m140 38 77 99H63l77-99Z" fill="currentColor" fillOpacity=".08"/>
        <path d="m140 38 38 99m-38-99-38 99m38-61 21 61h-42l21-61ZM140 29v12M60 144h160M79 70l-7-4m133 1-7 5"/>
        <path d="M58 42h17m-8-8v16M209 33h10m-5-5v10" strokeWidth="2" opacity=".4"/>
      </>}
      {category === 'Electronics' && <>
        <path d="M80 72h117a13 13 0 0 1 13 13v37a13 13 0 0 1-13 13H80a13 13 0 0 1-13-13V85a13 13 0 0 1 13-13Z" fill="currentColor" fillOpacity=".09"/>
        <ellipse cx="178" cy="103" rx="22" ry="23"/><ellipse cx="178" cy="103" rx="13" ry="14"/>
        <path d="M82 91h42m-42 10h42m-42 10h42M83 136v6m108-6v6M99 61h71"/>
      </>}
      {category === 'Events' && <>
        <rect x="101" y="35" width="79" height="109" rx="13" fill="currentColor" fillOpacity=".09"/>
        <circle cx="140" cy="105" r="25"/><circle cx="140" cy="105" r="12"/><circle cx="140" cy="61" r="10"/>
        <path d="M194 77V52l16-4v22m-16 10c-8-7-14 4-6 7 4 1 6-2 6-7Zm16-8c-8-7-14 4-6 7 4 1 6-2 6-7Z" strokeWidth="2"/>
      </>}
    </g>
  </svg>;
}
