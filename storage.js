(() => {
    const STORAGE_KEY = "flashcards-app-state";
    const STATE_VERSION = 1;

    function createDefaultState() {
        return {
            decks: [
                {
                    id: 1,
                    name: "Biology",
                    cards: [{ id: 1, question: "What is the basic unit of life?", answer: "The cell." }],
                },
                {
                    id: 2,
                    name: "Spanish",
                    cards: [{ id: 2, question: "How do you say hello in Spanish?", answer: "Hola." }],
                },
                {
                    id: 3,
                    name: "World history",
                    cards: [{ id: 3, question: "Which ancient civilization built the pyramids at Giza?", answer: "Ancient Egypt." }],
                },
            ],
            activeDeckId: 1,
        };
    }

    function isValidId(value) {
        return Number.isSafeInteger(value) && value > 0;
    }

    function normalizeState(value) {
        if (!value || typeof value !== "object" || value.version !== STATE_VERSION || !Array.isArray(value.decks)) {
            return null;
        }

        const decks = value.decks
            .filter((deck) => deck && isValidId(deck.id) && typeof deck.name === "string" && Array.isArray(deck.cards))
            .map((deck) => ({
                id: deck.id,
                name: deck.name.trim().slice(0, 60) || "Untitled deck",
                cards: deck.cards
                    .filter((card) => card && isValidId(card.id) && typeof card.question === "string" && typeof card.answer === "string")
                    .map((card) => ({
                        id: card.id,
                        question: card.question.slice(0, 500),
                        answer: card.answer.slice(0, 1000),
                    })),
            }));

        const activeDeckId = decks.some((deck) => deck.id === value.activeDeckId)
            ? value.activeDeckId
            : decks[0]?.id ?? null;
        return { decks, activeDeckId };
    }

    function loadState() {
        try {
            const serialized = window.localStorage.getItem(STORAGE_KEY);
            if (!serialized) return createDefaultState();
            const parsed = JSON.parse(serialized);
            return normalizeState(parsed) ?? createDefaultState();
        } catch {
            return createDefaultState();
        }
    }

    function saveState(state) {
        try {
            if (!state || !Array.isArray(state.decks)) return false;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: STATE_VERSION,
                decks: state.decks,
                activeDeckId: state.activeDeckId ?? null,
            }));
            return true;
        } catch {
            return false;
        }
    }

    window.FlashcardStorage = { loadState, saveState };
})();
