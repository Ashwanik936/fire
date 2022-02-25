import { ApplicationCommandMessage } from "@fire/lib/extensions/appcommandmessage";
import { FireMember } from "@fire/lib/extensions/guildmember";
import { FireUser } from "@fire/lib/extensions/user";
import { Command } from "@fire/lib/util/command";
import { Language } from "@fire/lib/util/language";
import * as centra from "centra";

const WORDLE_START_DATE = +new Date(2021, 5, 19, 0, 0, 0, 0);

enum GameStatus {
  IN_PROGRESS,
  WIN,
  FAIL,
}
type GameGuesses = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  fail: number;
};

type GameState = {
  boardWords: string[];
  hardMode: boolean;
  lastPlayedTime: number;
  lastCompletedTime: number;
  status: GameStatus;
};

type GameStats = {
  streak: number;
  gamesPlayed: number;
  gamesWon: number;
  guesses: GameGuesses;
  highestStreak: number;
};

export default class Wordle extends Command {
  emojis = {
    absent: "⬛",
    present: "🟨",
    correct: "🟩",
  };
  currentSolution: string;
  solutionDate: Date;
  constructor() {
    super("wordle", {
      description: (language: Language) =>
        language.get("WORDLE_COMMAND_DESCRIPTION"),
      enableSlashCommand: true,
      restrictTo: "all",
      slashOnly: true,
      ephemeral: true,
    });
  }

  async init() {
    await this.fetchCurrentSolution();
  }

  get currentDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  get wordleNumber() {
    return Math.floor((+new Date() - WORDLE_START_DATE) / 86400000);
  }

  async run(command: ApplicationCommandMessage) {
    if (!this.solutionDate || +this.currentDate != +this.solutionDate)
      await this.fetchCurrentSolution();
    if (!this.currentSolution)
      return await command.error("WORDLE_SOLUTION_UNKNOWN");
  }

  getGameState(user: FireMember | FireUser) {
    return user.settings.get<GameState>("wordle.state", {
      boardWords: [],
      hardMode: false,
      lastPlayedTime: null,
      lastCompletedTime: null,
      status: GameStatus.IN_PROGRESS,
    });
  }

  private async setGameState(user: FireMember | FireUser, state: GameState) {
    return await user.settings.set("wordle.state", state);
  }

  getGameStats(user: FireMember | FireUser) {
    return user.settings.get<GameStats>("wordle.stats", {
      streak: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      guesses: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        fail: 0,
      },
      highestStreak: 0,
    });
  }

  private async setGameStats(user: FireMember | FireUser, stats: GameStats) {
    return await user.settings.set("wordle.stats", stats);
  }

  private getEmojisForGuess(guess: string): string[] {
    return guess.split("").map((char, index) => {
      const solutionIndex = this.currentSolution.indexOf(char);
      if (solutionIndex == -1) return this.emojis.absent;
      else if (solutionIndex == index) return this.emojis.correct;
      else return this.emojis.present;
    });
  }

  getBoard(state: GameState) {
    return {
      entries: Array.from(
        { length: 6 },
        (_, index) => state.boardWords[index]?.split("") ?? []
      ),
      number: this.wordleNumber,
    };
  }

  private async fetchCurrentSolution() {
    delete this.currentSolution;
    delete this.solutionDate;
    for (let i = 0; i < 3; i++) {
      // we'll make a max of 3 attempts
      const res = await centra(
        process.env.REST_HOST
          ? `https://${process.env.REST_HOST}/v2/wordle/today`
          : `http://127.0.0.1:${process.env.REST_PORT}/v2/wordle/today`
      )
        .header("User-Agent", this.client.manager.ua)
        .send();
      if (res.statusCode == 200) {
        const body = await res.json();
        if (body.solution) {
          this.solutionDate = this.currentDate;
          this.currentSolution = body.solution;
        }
      }
    }
  }
}
