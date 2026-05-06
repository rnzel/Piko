import { Colors } from "@/constants/theme";
import React, { ReactNode } from "react";
import {
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  minHeight?: number;
};

const BottomSheet = ({
  visible,
  onClose,
  title,
  children,
  footer,
  minHeight = 260,
}: Props) => {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;
  const modalSheetMaxHeight = screenHeight - insets.top - insets.bottom - 48;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalRoot,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 3,
          },
        ]}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={20}
          style={{ width: "100%" }}
        >
          <View
            style={[
              styles.modalSheet,
              { maxHeight: modalSheetMaxHeight, minHeight },
            ]}
          >
            <View style={styles.modalHandle} />
            {title ? (
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{title}</Text>
              </View>
            ) : null}

            <ScrollView
              contentContainerStyle={[
                styles.modalScrollContent,
                { flexGrow: 1, paddingBottom: 8 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer && <View style={styles.modalFooter}>{footer}</View>}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 260,
    maxWidth: 420,
    width: "100%",
    alignSelf: "stretch",
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.light.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.light.text,
  },
  modalFooter: {
    alignItems: "stretch",
    paddingTop: 8,
    paddingBottom: 12,
  },
});

export default BottomSheet;
