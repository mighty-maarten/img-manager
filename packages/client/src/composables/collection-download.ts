import { ref } from 'vue';
import { CollectionService } from '@/api/services/collection';
import { useToastMessages } from '@/composables/toast';

export function useCollectionDownload() {
    const { successToast, errorToast } = useToastMessages();
    const isDownloading = ref(false);

    async function downloadCollection(collectionId: string) {
        try {
            isDownloading.value = true;

            // Check if browser supports File System Access API
            if (!('showDirectoryPicker' in window)) {
                errorToast('Your browser does not support folder selection', 'Please use a modern browser like Chrome or Edge');
                return;
            }

            // Get download URLs from API
            const downloadData = await CollectionService.getCollectionDownloadUrls(collectionId);

            if (!downloadData.downloads || downloadData.downloads.length === 0) {
                errorToast('No images available for download', '');
                return;
            }

            // Show directory picker
            const directoryHandle = await (window as any).showDirectoryPicker();

            let successCount = 0;
            let failedCount = 0;

            // Download each file
            for (const download of downloadData.downloads) {
                try {
                    // Fetch the file from the presigned URL
                    const response = await fetch(download.downloadUrl);
                    if (!response.ok) throw new Error('Download failed');

                    const blob = await response.blob();

                    // Create file in the selected directory
                    const fileHandle = await directoryHandle.getFileHandle(download.filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();

                    successCount++;
                } catch (error: any) {
                    console.error(`Failed to download ${download.filename}:`, error);

                    // Check if it's a CORS-related error
                    if (error.message?.includes('CORS') || error.name === 'TypeError') {
                        console.error('CORS error detected. This may be due to S3 bucket CORS configuration.');
                    }

                    failedCount++;
                }
            }

            if (successCount > 0) {
                successToast(
                    `Successfully downloaded ${successCount} image(s)`,
                    failedCount > 0 ? `${failedCount} download(s) failed` : ''
                );
            } else {
                errorToast(
                    'All downloads failed',
                    'This may be due to network issues or CORS configuration. Check the console for details.'
                );
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                // User cancelled the directory picker
                return;
            }
            console.error('Download error:', error);
            errorToast('Download failed', error.message || 'An error occurred');
        } finally {
            isDownloading.value = false;
        }
    }

    return {
        isDownloading,
        downloadCollection,
    };
}
