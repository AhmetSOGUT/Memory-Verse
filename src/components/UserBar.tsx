interface UserBarProps {
  name: string;
  onLogout: () => void;
}

/** Sağ üstte giriş yapan kişinin adı ve çıkış düğmesi. */
function UserBar({ name, onLogout }: UserBarProps) {
  return (
    <div className="user-bar">
      <span className="user-bar__name">{name}</span>
      <button className="user-bar__btn" onClick={onLogout}>
        Çıkış
      </button>
    </div>
  );
}

export default UserBar;