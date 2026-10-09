"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { VoiceCreateForm } from "./voice-create-form";
import { Button } from "@/components/ui/button";

interface VoiceCreateDialogProps {
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function VoiceCreateDialog({ children, open, onOpenChange }: VoiceCreateDialogProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children && <DrawerTrigger render={children} />}
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Create custom Voice</DrawerTitle>
            <DrawerDescription>Fill out the form to create a new voice.</DrawerDescription>
          </DrawerHeader>
          <VoiceCreateForm
            scrollable
            footer={(submit) => (
              <DrawerFooter>
                {submit}
                <DrawerClose render={<Button variant="outline" />}>
                  Cancel
                </DrawerClose>
              </DrawerFooter>
            )}
          />
        </DrawerContent>
      </Drawer>
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger render={children} />}
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle>Create custom voice</DialogTitle>
          <DialogDescription>Upload or record an audio sample to add a new voice to your library.</DialogDescription>
        </DialogHeader>
        <VoiceCreateForm />
      </DialogContent>
    </Dialog>
  );
};