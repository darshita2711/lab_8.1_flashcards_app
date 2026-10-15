(() => {
    const savedState = window.FlashcardStorage.loadState();
    const decks = savedState.decks;
    let nextDeckId = Math.max(0, ...decks.map((deck) => deck.id)) + 1;
    let nextCardId = Math.max(0, ...decks.flatMap((deck) => deck.cards.map((flashcard) => flashcard.id))) + 1;
    let activeDeckId = savedState.activeDeckId;
    let currentCardIndex = 0;
    let searchQuery = "";
    let searchTimer = null;
    let editorMode = null;
    let editingDeckId = null;
    let editingCardId = null;
    let returnFocusTo = null;
    let studyModeActive = false;
    let removeStudyKeyListener = null;

    const appShell = document.querySelector(".app-shell");
    const deckList = document.querySelector("#deck-list");
    const addDeckButton = document.querySelector(".icon-button");
    const studyModeToggle = document.querySelector("#study-mode-toggle");
    const studySection = document.querySelector(".study-section");
    const studyShortcuts = document.querySelector("#study-shortcuts");
    const cardSearchInput = document.querySelector("#card-search");
    const searchCount = document.querySelector("#search-count");
    const card = document.querySelector(".card");
    const frontFace = document.querySelector(".card-front");
    const backFace = document.querySelector(".card-back");
    const modal = document.querySelector("#deck-modal");
    const modalPanel = modal.querySelector(".modal-panel");
    const modalTitle = document.querySelector("#deck-modal-title");
    const modalDescription = document.querySelector("#deck-modal-description");
    const form = document.querySelector("#deck-form");
    const deckNameField = document.querySelector("#deck-name-field");
    const nameInput = document.querySelector("#deck-name");
    const cardFields = document.querySelector("#card-fields");
    const questionInput = document.querySelector("#card-question");
    const answerInput = document.querySelector("#card-answer");
    const saveButton = document.querySelector("#deck-modal-save");
    const cancelButton = document.querySelector("#deck-modal-cancel");

    function activeDeck() {
        return decks.find((deck) => deck.id === activeDeckId) ?? null;
    }

    function matchingCards(deck = activeDeck()) {
        if (!deck) return [];
        const query = searchQuery.trim().toLocaleLowerCase();
        if (!query) return deck.cards;
        return deck.cards.filter((flashcard) =>
            `${flashcard.question} ${flashcard.answer}`.toLocaleLowerCase().includes(query),
        );
    }

    function persistState() {
        window.FlashcardStorage.saveState({ decks, activeDeckId });
    }

    function currentCard() {
        return matchingCards()[currentCardIndex] ?? null;
    }

    function makeButton(label, className, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
    }

    function renderDecks() {
        deckList.replaceChildren();

        decks.forEach((deck) => {
            const item = document.createElement("li");
            item.className = "deck-item";

            const selectButton = document.createElement("button");
            selectButton.type = "button";
            selectButton.className = `deck-link${deck.id === activeDeckId ? " is-active" : ""}`;
            selectButton.setAttribute("aria-pressed", String(deck.id === activeDeckId));
            selectButton.dataset.deckSelect = String(deck.id);
            const name = document.createElement("span");
            name.className = "deck-name";
            name.textContent = deck.name;
            const count = document.createElement("span");
            count.className = "deck-count";
            count.textContent = String(deck.cards.length);
            count.setAttribute("aria-label", `${deck.cards.length} cards`);
            selectButton.append(name, count);
            selectButton.addEventListener("click", () => {
                enterStudyMode(deck.id);
                persistState();
                deckList.querySelector(`[data-deck-select="${activeDeckId}"]`)?.focus();
            });

            const actions = document.createElement("div");
            actions.className = "deck-actions";
            const renameButton = makeButton("Rename", "deck-action", () => openEditor("rename-deck", deck, document.activeElement));
            renameButton.setAttribute("aria-label", `Rename ${deck.name}`);
            renameButton.dataset.deckRename = String(deck.id);
            const deleteButton = makeButton("Delete", "deck-action deck-action-danger", () => deleteDeck(deck.id));
            deleteButton.setAttribute("aria-label", `Delete ${deck.name}`);
            actions.append(renameButton, deleteButton);
            item.append(selectButton, actions);
            deckList.append(item);
        });
    }

    function renderCard() {
        const deck = activeDeck();
        const visibleCards = matchingCards(deck);
        const flashcard = currentCard();
        const flipButton = frontFace.querySelector('[data-action="flip"]');
        const backFlipButton = backFace.querySelector('[data-action="flip"]');

        card.classList.remove("is-flipped");
        frontFace.setAttribute("aria-hidden", String(!flashcard));
        frontFace.inert = !flashcard;
        backFace.setAttribute("aria-hidden", "true");
        backFace.inert = true;

        if (flashcard) {
            document.querySelector("#deck-title").textContent = deck.name;
            document.querySelector(".progress").textContent = `Card ${currentCardIndex + 1} of ${visibleCards.length}`;
            document.querySelector(".card-prompt").textContent = flashcard.question;
            document.querySelector(".card-answer").textContent = flashcard.answer;
            flipButton.disabled = false;
            backFlipButton.disabled = false;
        } else {
            document.querySelector("#deck-title").textContent = deck?.name ?? "No decks yet";
            document.querySelector(".progress").textContent = deck ? "No cards yet" : "Create a deck to get started";
            document.querySelector(".card-prompt").textContent = deck
                ? (searchQuery.trim() ? "No cards match your search." : "Add a card to start studying this deck.")
                : "Your flashcards will appear here.";
            document.querySelector(".card-answer").textContent = "";
            flipButton.disabled = true;
            backFlipButton.disabled = true;
        }

        searchCount.textContent = searchQuery.trim()
            ? `${visibleCards.length} match${visibleCards.length === 1 ? "" : "es"} (${deck?.cards.length ?? 0} ${deck?.cards.length === 1 ? "card" : "cards"})`
            : `${visibleCards.length} card${visibleCards.length === 1 ? "" : "s"}`;

        studySection.querySelector('[data-action="previous-card"]').disabled = !deck || currentCardIndex <= 0;
        studySection.querySelector('[data-action="next-card"]').disabled = !deck || currentCardIndex >= visibleCards.length - 1;
        studySection.querySelector('[data-action="edit-card"]').disabled = !flashcard;
        studySection.querySelector('[data-action="delete-card"]').disabled = !flashcard;
    }

    function render() {
        renderDecks();
        renderCard();
        studyModeToggle.textContent = studyModeActive ? "Exit study mode" : "Enter study mode";
        studyModeToggle.setAttribute("aria-pressed", String(studyModeActive));
        studyModeToggle.disabled = decks.length === 0;
        studyShortcuts.hidden = !studyModeActive;
    }

    function exitStudyMode() {
        if (removeStudyKeyListener) {
            removeStudyKeyListener();
            removeStudyKeyListener = null;
        }
        studyModeActive = false;
        render();
    }

    function enterStudyMode(deckId) {
        const deck = decks.find((item) => item.id === Number(deckId));
        if (!deck) return false;

        if (removeStudyKeyListener) {
            removeStudyKeyListener();
            removeStudyKeyListener = null;
        }
        activeDeckId = deck.id;
        currentCardIndex = 0;
        studyModeActive = true;
        render();
        persistState();

        const onStudyKeyDown = (event) => {
            const target = event.target;
            if (!studyModeActive || !modal.hidden || modal.contains(target) || event.altKey || event.ctrlKey || event.metaKey) return;
            if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;

            if (event.key === "Escape") {
                event.preventDefault();
                exitStudyMode();
            } else if (event.key === "ArrowLeft" && currentCardIndex > 0) {
                event.preventDefault();
                currentCardIndex -= 1;
                renderCard();
                frontFace.querySelector('[data-action="flip"]').focus();
            } else if (event.key === "ArrowRight" && currentCardIndex < matchingCards().length - 1) {
                event.preventDefault();
                currentCardIndex += 1;
                renderCard();
                frontFace.querySelector('[data-action="flip"]').focus();
            } else if (event.key.toLowerCase() === "f" && currentCard()) {
                event.preventDefault();
                frontFace.querySelector('[data-action="flip"]').click();
            }
        };

        document.addEventListener("keydown", onStudyKeyDown);
        removeStudyKeyListener = () => document.removeEventListener("keydown", onStudyKeyDown);
        return true;
    }

    function openEditor(mode, item = null, opener = document.activeElement) {
        editorMode = mode;
        editingDeckId = mode === "rename-deck" ? item.id : null;
        editingCardId = mode === "edit-card" ? item.id : null;
        returnFocusTo = opener instanceof HTMLElement ? opener : addDeckButton;
        const isCardEditor = mode === "create-card" || mode === "edit-card";

        deckNameField.hidden = isCardEditor;
        cardFields.hidden = !isCardEditor;
        modalTitle.textContent = ({
            "create-deck": "Create a deck",
            "rename-deck": "Rename deck",
            "create-card": "Create a card",
            "edit-card": "Edit card",
        })[mode];
        modalDescription.textContent = isCardEditor
            ? "Add a question and its answer to the current deck."
            : "Choose a name for your flashcard deck.";
        saveButton.textContent = mode.startsWith("create") ? "Create" : "Save changes";
        nameInput.required = !isCardEditor;
        questionInput.required = isCardEditor;
        answerInput.required = isCardEditor;
        nameInput.value = mode === "rename-deck" ? item.name : "";
        questionInput.value = mode === "edit-card" ? item.question : "";
        answerInput.value = mode === "edit-card" ? item.answer : "";

        appShell.inert = true;
        modal.hidden = false;
        (isCardEditor ? questionInput : nameInput).focus();
    }

    function closeEditor() {
        if (modal.hidden) return;
        modal.hidden = true;
        appShell.inert = false;
        form.reset();
        nameInput.required = false;
        questionInput.required = false;
        answerInput.required = false;
        if (returnFocusTo?.isConnected) returnFocusTo.focus();
        returnFocusTo = null;
        editorMode = null;
        editingDeckId = null;
        editingCardId = null;
    }

    function deleteDeck(deckId) {
        const deletedIndex = decks.findIndex((deck) => deck.id === deckId);
        if (deletedIndex < 0) return;
        const deletedActiveDeck = activeDeckId === deckId;
        const wasStudyModeActive = studyModeActive;
        decks.splice(deletedIndex, 1);
        if (deletedActiveDeck) {
            activeDeckId = decks[Math.min(deletedIndex, decks.length - 1)]?.id ?? null;
            currentCardIndex = 0;
        }
        render();
        if (deletedActiveDeck && wasStudyModeActive) {
            if (activeDeckId !== null) enterStudyMode(activeDeckId);
            else exitStudyMode();
        }
        persistState();
        if (activeDeckId !== null) {
            deckList.querySelector(`[data-deck-select="${activeDeckId}"]`)?.focus();
        } else {
            addDeckButton.focus();
        }
    }

    addDeckButton.addEventListener("click", () => openEditor("create-deck", null, addDeckButton));
    cardSearchInput.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
            searchQuery = cardSearchInput.value;
            currentCardIndex = 0;
            renderCard();
        }, 300);
    });
    studyModeToggle.addEventListener("click", () => {
        if (studyModeActive) exitStudyMode();
        else enterStudyMode(activeDeckId ?? decks[0]?.id);
    });
    cancelButton.addEventListener("click", closeEditor);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const isCardEditor = editorMode === "create-card" || editorMode === "edit-card";
        const renamedDeckId = editorMode === "rename-deck" ? editingDeckId : null;
        const createdDeckId = editorMode === "create-deck" ? nextDeckId : null;

        if (isCardEditor) {
            const question = questionInput.value.trim();
            const answer = answerInput.value.trim();
            if (!question || !answer || !activeDeck()) return;

            if (editorMode === "edit-card") {
                const existingCard = activeDeck().cards.find((item) => item.id === editingCardId);
                if (existingCard) {
                    existingCard.question = question;
                    existingCard.answer = answer;
                }
                const matchingCount = matchingCards().length;
                currentCardIndex = Math.max(0, Math.min(currentCardIndex, matchingCount - 1));
            } else {
                window.clearTimeout(searchTimer);
                searchQuery = "";
                cardSearchInput.value = "";
                activeDeck().cards.push({ id: nextCardId++, question, answer });
                currentCardIndex = activeDeck().cards.length - 1;
            }
        } else {
            const name = nameInput.value.trim();
            if (!name) return;

            if (editorMode === "rename-deck") {
                const deck = decks.find((item) => item.id === editingDeckId);
                if (deck) deck.name = name;
            } else {
                const deck = { id: nextDeckId++, name, cards: [] };
                decks.push(deck);
                activeDeckId = deck.id;
                currentCardIndex = 0;
            }
        }

        closeEditor();
        render();
        persistState();
        if (createdDeckId !== null) enterStudyMode(createdDeckId);
        if (renamedDeckId !== null) {
            deckList.querySelector(`[data-deck-rename="${renamedDeckId}"]`)?.focus();
        }
    });

    // Card controls are handled here so regenerated or future card controls need no listeners of their own.
    studySection.addEventListener("click", (event) => {
        const control = event.target.closest("[data-action]");
        if (!control || !studySection.contains(control) || control.disabled) return;

        const deck = activeDeck();
        const flashcard = currentCard();
        switch (control.dataset.action) {
            case "flip": {
                const flipped = card.classList.toggle("is-flipped");
                frontFace.setAttribute("aria-hidden", String(flipped));
                frontFace.inert = flipped;
                backFace.setAttribute("aria-hidden", String(!flipped));
                backFace.inert = !flipped;
                (flipped ? backFace : frontFace).querySelector('[data-action="flip"]').focus();
                break;
            }
            case "create-card":
                if (deck) openEditor("create-card", null, control);
                break;
            case "edit-card":
                if (flashcard) openEditor("edit-card", flashcard, control);
                break;
            case "delete-card":
                if (deck && flashcard) {
                    deck.cards = deck.cards.filter((item) => item.id !== flashcard.id);
                    currentCardIndex = Math.max(0, Math.min(currentCardIndex, matchingCards(deck).length - 1));
                    render();
                    persistState();
                    studySection.querySelector('[data-action="create-card"]').focus();
                }
                break;
            case "previous-card":
                if (currentCardIndex > 0) currentCardIndex -= 1;
                renderCard();
                break;
            case "next-card":
                if (deck && currentCardIndex < matchingCards(deck).length - 1) currentCardIndex += 1;
                renderCard();
                break;
        }
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeEditor();
    });

    modalPanel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeEditor();
            return;
        }
        if (event.key !== "Tab") return;

        const focusable = [...modalPanel.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )].filter((element) => !element.closest("[hidden]") && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
            event.preventDefault();
            modalPanel.focus();
        } else if (event.shiftKey && (document.activeElement === first || !modalPanel.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !modalPanel.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
        }
    });

    if (!enterStudyMode(activeDeckId)) render();
})();
