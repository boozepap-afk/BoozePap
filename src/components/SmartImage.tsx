import Image from 'next/image';

type SmartImageProps = { src: string; alt: string; sizes: string; className?: string; fit?: 'cover' | 'contain'; position?: string; priority?: boolean; quality?: number };

/** Consistent responsive rendering for every customer-facing merchandise image. */
export function SmartImage({ src, alt, sizes, className = '', fit = 'cover', position = '50% 50%', priority = false, quality = 88 }: SmartImageProps) {
  return <Image fill src={src} alt={alt} sizes={sizes} quality={quality} priority={priority} loading={priority ? 'eager' : 'lazy'} className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${className}`} style={{ objectPosition: position }} />;
}
