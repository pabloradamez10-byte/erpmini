import { useEffect, useRef } from "react";

export function BarcodeImage({ value }) {
  const ref = useRef();

  useEffect(() => {
    if (!value || !ref.current) return;
    const render = () => {
      if (window.JsBarcode) {
        try {
          window.JsBarcode(ref.current, value, { format:"CODE128", width:1.5, height:40, displayValue:true, fontSize:11, margin:4 });
        } catch {}
      }
    };

    if (!window.JsBarcode) {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js";
      script.onload = render;
      document.head.appendChild(script);
    } else {
      render();
    }
  }, [value]);

  if (!value) return null;
  return <svg ref={ref} style={{ maxWidth:"100%" }} />;
}

export function generateBarcode() {
  return String(Math.floor(1000000000000 + Math.random() * 9000000000000));
}
