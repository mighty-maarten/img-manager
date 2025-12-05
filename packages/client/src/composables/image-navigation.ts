import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export interface ImageNavigationCallbacks {
    onPrevious: () => void;
    onNext: () => void;
    onClose: () => void;
}

export interface ImageNavigationOptions {
    /** Whether navigation is enabled. Default: true */
    enabled?: Ref<boolean>;
    /** Disable swipe navigation when this ref is true (e.g., when zoomed). Default: undefined */
    disableSwipeWhenZoomed?: Ref<boolean>;
    /** Container element ref for touch events. If not provided, touch navigation won't be enabled */
    containerRef?: Ref<HTMLElement | null>;
}

/**
 * Composable for handling keyboard and touch/swipe navigation in image detail views.
 *
 * Provides:
 * - Keyboard navigation: Arrow keys (left/right for prev/next), Escape (close)
 * - Touch/swipe navigation: Horizontal swipe gestures for prev/next
 *
 * @param callbacks - Navigation callback functions
 * @param options - Configuration options
 */
export function useImageNavigation(
    callbacks: ImageNavigationCallbacks,
    options: ImageNavigationOptions = {}
) {
    const { onPrevious, onNext, onClose } = callbacks;
    const { enabled, disableSwipeWhenZoomed, containerRef } = options;

    // Touch/swipe state
    const touchStartX = ref(0);
    const touchStartY = ref(0);
    const touchEndX = ref(0);
    const touchEndY = ref(0);

    function handleKeydown(event: KeyboardEvent) {
        if (enabled && !enabled.value) return;

        switch (event.key) {
            case 'ArrowLeft':
                onPrevious();
                break;
            case 'ArrowRight':
                onNext();
                break;
            case 'Escape':
                onClose();
                break;
        }
    }

    function handleTouchStart(event: TouchEvent) {
        if (enabled && !enabled.value) return;

        touchStartX.value = event.touches[0].clientX;
        touchStartY.value = event.touches[0].clientY;
    }

    function handleTouchEnd(event: TouchEvent) {
        if (enabled && !enabled.value) return;

        touchEndX.value = event.changedTouches[0].clientX;
        touchEndY.value = event.changedTouches[0].clientY;
        handleSwipe();
    }

    function handleSwipe() {
        // Don't navigate on swipe when disabled (e.g., when zoomed in)
        if (disableSwipeWhenZoomed && disableSwipeWhenZoomed.value) {
            return;
        }

        const minSwipeDistance = 50; // Minimum distance for a swipe to be detected
        const maxVerticalDistance = 100; // Maximum vertical movement allowed for horizontal swipe

        const horizontalDistance = touchEndX.value - touchStartX.value;
        const verticalDistance = Math.abs(touchEndY.value - touchStartY.value);

        // Only trigger swipe if horizontal movement is significant and vertical movement is minimal
        if (Math.abs(horizontalDistance) < minSwipeDistance || verticalDistance > maxVerticalDistance) {
            return;
        }

        if (horizontalDistance > 0) {
            // Swiped right - go to previous image
            onPrevious();
        } else {
            // Swiped left - go to next image
            onNext();
        }
    }

    function attachTouchListeners() {
        if (containerRef?.value) {
            containerRef.value.addEventListener('touchstart', handleTouchStart, { passive: true });
            containerRef.value.addEventListener('touchend', handleTouchEnd, { passive: true });
        }
    }

    function removeTouchListeners() {
        if (containerRef?.value) {
            containerRef.value.removeEventListener('touchstart', handleTouchStart);
            containerRef.value.removeEventListener('touchend', handleTouchEnd);
        }
    }

    onMounted(() => {
        // Always attach keyboard listeners
        window.addEventListener('keydown', handleKeydown);

        // Attach touch listeners if container ref is provided
        if (containerRef) {
            attachTouchListeners();
        }
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', handleKeydown);

        if (containerRef) {
            removeTouchListeners();
        }
    });

    // Return functions for manual control if needed
    return {
        attachTouchListeners,
        removeTouchListeners
    };
}
