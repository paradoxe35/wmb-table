import { type MouseEvent, type RefObject, useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { msSinceUserScroll, noteUserJump } from '@renderer/utils/user-scroll';
import { prefersReducedMotion } from './follow-reading';

/** Scrolling this far in one direction is a deliberate move, not a nudge of the wheel. */
const DIRECTION_THRESHOLD_PX = 40;
/** Upward moves count only right after the reader's own input, not zoom, navigation or follow reading. */
const OWN_SCROLL_WINDOW_MS = 1_000;

export interface ScrollState {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
    /** The reader is moving back up the document. */
    goingUp: boolean;
}

/** Shown far from the start, only near the end or while the reader heads back up. */
export function shouldShowTopButton({
    scrollTop,
    clientHeight,
    scrollHeight,
    goingUp,
}: ScrollState): boolean {
    if (clientHeight <= 0 || scrollTop <= clientHeight) return false;
    const nearEnd = scrollHeight - scrollTop - clientHeight <= clientHeight / 2;
    return nearEnd || goingUp;
}

function useTopButtonVisible(scrollerRef: RefObject<HTMLElement | null>, active: boolean) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!active || !scroller) {
            setVisible(false);
            return;
        }

        let anchor = scroller.scrollTop;
        let goingUp = false;
        let frameId = 0;
        const update = () => {
            frameId = 0;
            const { scrollTop, clientHeight, scrollHeight } = scroller;
            if (scrollTop < anchor - DIRECTION_THRESHOLD_PX) {
                goingUp = msSinceUserScroll(scroller) < OWN_SCROLL_WINDOW_MS;
                anchor = scrollTop;
            } else if (scrollTop > anchor + DIRECTION_THRESHOLD_PX) {
                goingUp = false;
                anchor = scrollTop;
            } else if (goingUp ? scrollTop < anchor : scrollTop > anchor) {
                anchor = scrollTop;
            }
            setVisible(shouldShowTopButton({ scrollTop, clientHeight, scrollHeight, goingUp }));
        };
        const onScroll = () => {
            if (!frameId) frameId = requestAnimationFrame(update);
        };

        update();
        scroller.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            scroller.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            cancelAnimationFrame(frameId);
        };
    }, [scrollerRef, active]);

    return visible;
}

export default function DocumentTopButton({
    scrollerRef,
    active,
}: {
    scrollerRef: RefObject<HTMLElement | null>;
    active: boolean;
}) {
    const { t } = useTranslation();
    const visible = useTopButtonVisible(scrollerRef, active);
    const label = t('Revenir au début');

    const goToTop = (event: MouseEvent) => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        noteUserJump(scroller);
        scroller.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
        // From the keyboard (no click count), focus would be lost when the button hides
        if (event.detail === 0) {
            const start = scroller.querySelector<HTMLElement>(
                '[data-document-start], [data-paragraph-index]',
            );
            if (start) {
                start.tabIndex = -1;
                start.focus({ preventScroll: true });
            }
        }
    };

    return (
        <div className={`document-top-button${visible ? ' document-top-button--visible' : ''}`}>
            <Tooltip title={label} placement="left" open={visible ? undefined : false}>
                <Button
                    shape="circle"
                    icon={<ArrowUpOutlined />}
                    aria-label={label}
                    tabIndex={visible ? 0 : -1}
                    onClick={goToTop}
                />
            </Tooltip>
        </div>
    );
}
