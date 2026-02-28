<script defer>
  // Configure PDF.js worker for in-app PDF rendering (used on mobile devices).
  window.addEventListener('DOMContentLoaded',()=>{
    try{
      if(window.pdfjsLib){
        pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
    }catch(e){}
  });
