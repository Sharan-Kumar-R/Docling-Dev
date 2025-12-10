import tempfile
import os
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

def process_document(file_content: bytes, filename: str, options: dict = None) -> dict:
    """
    Saves the uploaded content to a temporary file, converts it using Docling,
    and returns the Markdown content and metadata.
    """
    # Create a temporary file to save the uploaded content
    # Docling currently works best with file paths
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name

    try:
        # Initialize Docling converter
        pipeline_options = PdfPipelineOptions()
        
        if options:
            pipeline_options.do_ocr = options.get("ocr", False)
            pipeline_options.do_table_structure = options.get("table_extraction", True)
        else:
            pipeline_options.do_ocr = False
            pipeline_options.do_table_structure = True

        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
        
        # Convert the document
        result = converter.convert(tmp_path)
        
        # Export formats
        markdown_output = result.document.export_to_markdown()
        json_output = result.document.export_to_dict() # Serialize to dict/JSON
        html_output = result.document.export_to_html() # Export to HTML
        
        return {
            "filename": filename,
            "markdown": markdown_output,
            "json": json_output,
            "html": html_output,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "filename": filename,
            "error": str(e),
            "status": "error"
        }
    finally:
        # Clean up the temporary file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
