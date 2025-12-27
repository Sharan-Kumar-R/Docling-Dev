import os
from groq import Groq
from dotenv import load_dotenv
from chonkie import TokenChunker
import chromadb
from sentence_transformers import SentenceTransformer

load_dotenv()

class RAGEngine:
    def __init__(self):
        # API Key validation
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        self.client = Groq(api_key=api_key)
        self.model = "llama-3.3-70b-versatile"
        
        # Initialize Chonkie TokenChunker
        # Model max_seq_length is 256. Using 256 ensures no truncation by the embedder.
        self.chunker = TokenChunker(chunk_size=256, chunk_overlap=30)

        # Initialize ChromaDB (Persistent)
        self.chroma_client = chromadb.PersistentClient(path="chroma_db")
        
        # Initialize Embedding Model (Lightweight & Fast)
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')

    def index_document(self, session_id: str, text: str):
        """
        Chunks the document, generates embeddings, and saves to ChromaDB.
        """
        if not text:
            return

        # 1. Chunk the text
        chunks = self.chunker(text)
        chunk_texts = [chunk.text for chunk in chunks]
        
        # 2. Generate Embeddings
        embeddings = self.embedder.encode(chunk_texts)
        
        # 3. Store in ChromaDB
        # Use session_id as collection name to isolate documents
        try:
            # Delete existing collection if it exists (to handle re-uploads same session)
            try:
                self.chroma_client.delete_collection(name=session_id)
            except:
                pass
                
            collection = self.chroma_client.get_or_create_collection(name=session_id)
            
            ids = [f"{session_id}_{i}" for i in range(len(chunk_texts))]
            
            collection.add(
                documents=chunk_texts,
                embeddings=embeddings.tolist(), # Convert numpy array to list
                ids=ids
            )
            print(f"Indexed {len(chunk_texts)} chunks for session {session_id}")
            
        except Exception as e:
            print(f"Error indexing document: {e}")
            raise e

    def chat(self, query: str, session_id: str) -> str:
        """
        Retrieves relevant context from ChromaDB and sends to Groq.
        """
        try:
            # 1. Get Collection
            try:
                collection = self.chroma_client.get_collection(name=session_id)
            except Exception:
                return "Error: Document not found or session expired."

            # 2. Retrieve Relevant Chunks (Semantic Search)
            query_embedding = self.embedder.encode([query]).tolist()
            
            results = collection.query(
                query_embeddings=query_embedding,
                n_results=7 # Top 7 chunks
            )
            
            # flatten results (list of lists)
            relevant_chunks = results['documents'][0] if results['documents'] else []
            context_text = "\n\n...\n\n".join(relevant_chunks)

            # 3. Generate Answer
            system_prompt = f"""
            You are a helpful assistant analyzing a document.
            Use the following retrieved document excerpts to answer the user's question.
            If the answer is not in the excerpts, say so.
            
            Document Excerpts:
            {context_text}
            """
            
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": query,
                    }
                ],
                model=self.model,
            )
            return chat_completion.choices[0].message.content
            
        except Exception as e:
            return f"Error generating response: {str(e)}"
        

