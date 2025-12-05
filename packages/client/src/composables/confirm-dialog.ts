import { Icons } from '@/types/icons';
import { useConfirm } from 'primevue';

type Severity = 'success' | 'info' | 'warn' | 'danger';

export function useConfirmDialog() {
    const confirm = useConfirm();

    function openConfirmDialog(opts: {
        title: string;
        description: string;
        icon: string;
        acceptSeverity: Severity;
        acceptLabel: string;
        rejectLabel?: string;
        accept?: () => void | Promise<void>;
        reject?: () => void | Promise<void>;
    }) {
        return new Promise<void>((res) => {
            confirm.require({
                message: opts.description,
                header: opts.title,
                icon: opts.icon,
                rejectLabel: opts.rejectLabel || 'Annuleren',
                rejectProps: {
                    severity: 'secondary',
                    outlined: true,
                },
                acceptLabel: opts.acceptLabel,
                acceptProps: {
                    severity: opts.acceptSeverity,
                },
                accept: async () => {
                    if (opts.accept) await opts.accept();
                    res();
                },
                reject: async () => {
                    if (opts.reject) await opts.reject();
                    res();
                },
            });
        });
    }

    function confirmDelete(title: string, description: string, onRemove: () => void) {
        return openConfirmDialog({
            title,
            description,
            icon: Icons.delete,
            acceptSeverity: 'danger',
            acceptLabel: 'Verwijderen',
            accept: onRemove,
        });
    }

    function confirmWarn(
        title: string,
        description: string,
        acceptLabel: string,
        onAccept: () => void,
    ) {
        return openConfirmDialog({
            title,
            description,
            icon: Icons.warnTriangle,
            acceptSeverity: 'warn',
            acceptLabel: acceptLabel,
            accept: onAccept,
        });
    }

    return {
        openConfirmDialog,
        confirmDelete,
        confirmWarn,
    };
}
