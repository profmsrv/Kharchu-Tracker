// A wrapping grid of option buttons, for choices that are too many for one row of <Segmented>.
//
//   <ChipGrid value="aurora" onChange={setBackground} options={[{ key, label }, ...]} columns={3} />
export default function ChipGrid({ options, value, onChange, columns = 3 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map((option) => (
        <button key={option.key} type="button" className="bt-chip" aria-pressed={value === option.key} onClick={() => onChange(option.key)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
