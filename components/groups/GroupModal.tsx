import BottomSheet from "@/components/ui/BottomSheet";
import React, { ReactNode } from "react";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  minHeight?: number;
};

const GroupModal = ({
  visible,
  onClose,
  title,
  children,
  footer,
  minHeight,
}: Props) => {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={footer}
      minHeight={minHeight}
    >
      {children}
    </BottomSheet>
  );
};

export default GroupModal;
