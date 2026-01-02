
import { generateJsonContent } from "./core/services/ollamaService";

async function testOllama() {
    console.log("Testing Ollama JSON generation...");
    try {
        const result = await generateJsonContent("List 3 fruits", "You are a helpful assistant.");
        console.log("Success:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Failed:", error);
    }
}

testOllama();
