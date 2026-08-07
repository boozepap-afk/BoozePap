const DEFAULT_LOGO_SRC = '/boozepap-logo.svg';

export function BrandLogo({ footer = false }: { footer?: boolean; src?: string }) {
  return (
    <div className="flex shrink-0 items-center text-left">
      <img
        src={DEFAULT_LOGO_SRC}
        alt="BoozePap"
        className={footer ? 'h-28 w-auto object-contain' : 'h-16 w-auto object-contain sm:h-20'}
      />
    </div>
  );
}
