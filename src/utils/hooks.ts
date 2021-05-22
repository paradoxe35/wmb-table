import { useEffect, useRef } from "react"



export function useContainerScrollY<T>(resizers = [window]) {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    function rebuildEl() {
      if (containerRef.current) {
        const winHeight = window.innerHeight
        //@ts-ignore
        const { top } = containerRef.current.getBoundingClientRect()

        const diff = winHeight - top;
        if (diff > 0) {
          //@ts-ignore
          containerRef.current.style.height = `${diff}px`;
        }
      }
    }
    rebuildEl()
    window.addEventListener('load', rebuildEl)

    resizers.forEach(w => w.addEventListener('resize', rebuildEl))

    return () => {
      resizers.forEach(w => w.removeEventListener('resize', rebuildEl))
      window.removeEventListener('load', rebuildEl)
    }
  }, [])

  return containerRef
}
