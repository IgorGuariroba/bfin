import React from 'react';
import { Modal, Title, Text } from '@mantine/core';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  children: React.ReactNode;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
}

// Context para compartilhar o controle do modal
const DialogContext = React.createContext<{
  onClose: () => void;
}>({ onClose: () => {} });

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ onClose: () => onOpenChange(false) }}>
      <Modal
        opened={open}
        onClose={() => onOpenChange(false)}
        size="md"
        centered
        overlayProps={{ opacity: 0.55, blur: 3 }}
      >
        {children}
      </Modal>
    </DialogContext.Provider>
  );
}

export function DialogContent({ children, className = '' }: DialogContentProps) {
  return <div className={className}>{children}</div>;
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return <div className="mb-4">{children}</div>;
}

export function DialogTitle({ children }: DialogTitleProps) {
  return <Title order={3}>{children}</Title>;
}

export function DialogDescription({ children }: DialogDescriptionProps) {
  return <Text size="sm" c="dimmed" mt="xs">{children}</Text>;
}

export function DialogClose({ onClose }: { onClose?: () => void }) {
  // Mantine Modal já tem o botão de fechar embutido, então retornamos null
  // Se precisar de um botão customizado, pode usar:
  // const context = React.useContext(DialogContext);
  // const handleClose = onClose || context.onClose;
  // return <Button variant="outline" onClick={handleClose}>Fechar</Button>;

  // Evita warning de variável não usada
  void onClose;
  return null;
}
