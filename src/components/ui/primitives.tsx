import React, {useEffect} from 'react';
import {cva, type VariantProps} from 'class-variance-authority';
import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
import {X} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF243D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D] disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        crimson:
          'sukuna-crimson-btn text-white border border-[#FF243D]/40',
        secondary:
          'bg-rose-50 dark:bg-[#1A1013] text-zinc-900 dark:text-white border border-[#B00020]/35 hover:border-[#FF243D]/70 hover:bg-[#B00020]/20 hover:-translate-y-0.5',
        outline:
          'bg-transparent border border-[#650000]/60 dark:border-[#650000]/70 text-zinc-800 dark:text-zinc-200 hover:bg-[#B00020]/15 hover:border-[#FF243D]/60',
        ghost:
          'bg-transparent text-zinc-700 dark:text-[#B5B5B5] hover:bg-[#B00020]/15 hover:text-zinc-950 dark:hover:text-white',
        danger:
          'bg-red-900/80 text-white border border-red-500/40 hover:bg-red-700',
      },
      size: {
        default: 'min-h-[42px] px-4 py-2',
        sm: 'min-h-[36px] px-3 py-1.5 text-xs',
        lg: 'min-h-[48px] px-6 py-3 text-base',
        icon: 'min-h-[40px] min-w-[40px] p-2',
      },
    },
    defaultVariants: {
      variant: 'crimson',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, variant, size, type = 'button', ...props}, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({variant, size, className}))}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({className, ...props}, ref) => (
  <div
    ref={ref}
    className={cn('sukuna-card rounded-2xl p-4 transition-all duration-200', className)}
    {...props}
  />
));
Card.displayName = 'Card';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({className, ...props}, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full min-h-[44px] rounded-xl border border-[#650000]/60 bg-white dark:bg-[#151515] px-3.5 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-[#8A8A8A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF243D] transition-colors',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({className, children, ...props}, ref) => (
  <select
    ref={ref}
    className={cn(
      'w-full min-h-[44px] rounded-xl border border-[#650000]/60 bg-white dark:bg-[#151515] px-3 py-2 text-sm text-zinc-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF243D] transition-colors',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-lg',
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.16}}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-heading"
        >
          <motion.div
            initial={{opacity: 0, scale: 0.96, y: 10}}
            animate={{opacity: 1, scale: 1, y: 0}}
            exit={{opacity: 0, scale: 0.96, y: 10}}
            transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
            className={cn(
              'w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-[#B00020]/55 bg-white dark:bg-[#151515] p-5 shadow-2xl shadow-[#B00020]/25 text-zinc-900 dark:text-white',
              maxWidthClass
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#650000]/40 pb-3 mb-4">
              <div>
                <h2 id="modal-heading" className="text-lg font-bold tracking-tight">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-zinc-500 dark:text-[#B5B5B5] mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar janela"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 dark:text-[#B5B5B5] hover:bg-[#B00020]/20 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
