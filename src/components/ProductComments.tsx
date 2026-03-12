import { useState, useRef } from "react";
import { format } from "date-fns";
import { Send, Trash2, AtSign, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useProductComments, useAddComment, useDeleteComment, useTeamProfiles } from "@/hooks/useComments";
import { useAuth } from "@/hooks/useAuth";

interface ProductCommentsProps {
  productId: string;
  productName: string;
  trigger?: React.ReactNode;
}

export function ProductComments({ productId, productName, trigger }: ProductCommentsProps) {
  const [content, setContent] = useState("");
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuth();
  const { data: comments = [], isLoading } = useProductComments(productId);
  const { data: profiles = [] } = useTeamProfiles();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();

  const handleSubmit = () => {
    if (!content.trim()) return;
    addComment.mutate(
      { productId, content: content.trim(), mentionedUserIds: mentionedIds },
      {
        onSuccess: () => {
          setContent("");
          setMentionedIds([]);
        },
      }
    );
  };

  const handleMention = (profile: { id: string; email: string; full_name: string | null }) => {
    const name = profile.full_name || profile.email.split("@")[0];
    setContent((prev) => prev + `@${name} `);
    if (!mentionedIds.includes(profile.id)) {
      setMentionedIds((prev) => [...prev, profile.id]);
    }
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "@") {
      setShowMentions(true);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            {comments.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[11px]">
                {comments.length}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-left">
            <span className="text-base">Comments</span>
            <p className="text-sm font-normal text-muted-foreground truncate mt-0.5">
              {productName}
            </p>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No comments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to comment</p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {comments.map((comment) => (
                <div key={comment.id} className="group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {comment.user_email?.split("@")[0] || "User"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(comment.created_at), "MMM d, HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">
                        {comment.content}
                      </p>
                    </div>
                    {comment.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          deleteComment.mutate({ commentId: comment.id, productId })
                        }
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="border-t pt-4 space-y-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment... (⌘+Enter to send)"
              className="min-h-[60px] pr-20 resize-none"
            />
            <div className="absolute right-2 bottom-2 flex gap-1">
              <Popover open={showMentions} onOpenChange={setShowMentions}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <AtSign className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="end">
                  <div className="max-h-48 overflow-y-auto">
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-sm transition-colors"
                        onClick={() => handleMention(p)}
                      >
                        <span className="font-medium">{p.full_name || p.email.split("@")[0]}</span>
                        <span className="text-muted-foreground ml-1.5 text-xs">{p.email}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                size="icon"
                className="h-7 w-7"
                onClick={handleSubmit}
                disabled={!content.trim() || addComment.isPending}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {mentionedIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mentionedIds.map((id) => {
                const p = profiles.find((pr) => pr.id === id);
                return (
                  <Badge key={id} variant="secondary" className="text-[11px]">
                    @{p?.full_name || p?.email?.split("@")[0] || "user"}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
