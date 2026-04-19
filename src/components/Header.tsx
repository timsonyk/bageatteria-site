import Image from "next/image";

interface HeaderProps {
  rightElement?: React.ReactNode;
}

export function Header({ rightElement }: HeaderProps) {
  return (
    <header className="bg-background">
      <div className="flex items-center justify-between h-14 px-4">
        <Image
          src="/logo.svg"
          alt="Bageatteria"
          width={140}
          height={38}
          className="object-contain"
          priority
        />
        {rightElement}
      </div>
    </header>
  );
}
