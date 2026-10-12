// The user's round profile picture. Shows the photo (a small "data:image/..." text or a web address),
// or the first letter of the name when there is no photo or the picture cannot be loaded.
import { useEffect, useState } from 'react';

export default function Avatar({ photo, name, size = 40 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]); // try again when the photo changes

  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const letter = name ? name[0].toUpperCase() : 'F';
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bt-grad-avatar font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {letter}
    </div>
  );
}
