const DEFAULT_LOGO_SRC = '/chupahub-logo.svg';

export function BrandLogo({ footer = false, src = DEFAULT_LOGO_SRC }: { footer?: boolean; src?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1 text-left">
      <img
        src={src || DEFAULT_LOGO_SRC}
        alt=""
        aria-hidden="true"
        className={footer ? 'h-16 w-10 object-contain' : 'h-12 w-8 object-contain sm:h-14 sm:w-9'}
      />
      <span className={footer ? 'text-2xl font-black text-white' : 'text-xl font-black text-white sm:text-2xl'}>
        Chupa Hub
      </span>
    </div>
  );
}
