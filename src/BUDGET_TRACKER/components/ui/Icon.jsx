// Draws an icon from constants/icons.js.
//
//   <Icon name="cart" size={20} color="#f0605d" />
//
// If the name is not in the icon list (for example an old emoji), the text itself is shown instead.
import { ICONS } from '../../constants/icons';

export default function Icon({ name, size = 20, stroke = 1.9, color, className = '' }) {
  const markup = ICONS[name];
  if (!markup) return <span className={className}>{name}</span>;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"          // icons take the text colour of their parent...
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      style={color ? { color } : undefined} // ...unless a colour is given
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }} // our own trusted SVG strings
    />
  );
}
