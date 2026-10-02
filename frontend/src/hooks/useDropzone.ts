import { DragEvent, MouseEvent, useState } from 'react';

export function useDropzone(onFiles: (files: File[]) => void) {
  const [isDragging, setDragging] = useState(false);

  return {
    isDragging,
    onClick: (event: MouseEvent<HTMLElement>) => {
      const input = event.currentTarget.querySelector('input');
      input?.click();
    },
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(),
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      onFiles(Array.from(event.dataTransfer.files));
    },
  };
}
