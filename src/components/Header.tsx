import Image from "next/image";

interface HeaderProps {
  rightElement?: React.ReactNode;
}

export function Header({ rightElement }: HeaderProps) {
  return (
    <header
      className="bg-background"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-[1200px] mx-auto md:px-8">
        <a href="/">
          <Image
            src="/logo.svg"
            alt="Bageatteria"
            width={140}
            height={38}
            className="object-contain"
            priority
          />
        </a>
        {rightElement}
      </div>
    </header>
  );
}
